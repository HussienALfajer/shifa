// Link shaper control (profiles P1–P3; 0.3-S4b criteria 8–11). The link container sits on the
// clinic and cloud networks; egress on its cloud interface is the uplink, on its clinic
// interface the downlink. Every profile change and cut is logged with a timestamp for the
// report.
import { readFileSync } from 'node:fs';
import { docker, dockerJson } from './docker.ts';
import type { Link, LinkEvent, ProfileName } from './types.ts';

export interface Profile {
  upMbit: number;
  downMbit: number;
  rttMs: number;
  jitterMs: number;
  lossPercent: number;
  cuts: { everySeconds: number; cutSeconds: number } | null;
}

/** P1–P3 exactly as the spec's table; the link container reads the same file. */
export const PROFILES: Readonly<Record<ProfileName, Profile>> = JSON.parse(
  readFileSync(new URL('../../link/profiles.json', import.meta.url), 'utf8'),
) as Record<ProfileName, Profile>;

/** The link's interface name on a Docker network (matched by its address there). */
async function interfaceOn(container: string, network: string): Promise<string> {
  const [inspect] = await dockerJson<
    { NetworkSettings: { Networks: Record<string, { IPAddress: string }> } }[]
  >(['inspect', container]);
  const ip = inspect?.NetworkSettings.Networks[network]?.IPAddress;
  const addrs = (await docker(['exec', container, 'ip', '-o', '-4', 'addr', 'show'])).stdout;
  const line = addrs.split('\n').find((l) => ip && l.includes(` ${ip}/`));
  const name = line?.split(/\s+/)[1]?.replace(/@.*$/, '');
  if (!name) throw new Error(`link has no interface on ${network}`);
  return name;
}

export async function createLink(options: {
  container: string;
  cloudNetwork: string;
  clinicNetwork: string;
  sinkUrl?: string;
}): Promise<Link> {
  const { container } = options;
  const upIf = await interfaceOn(container, options.cloudNetwork);
  const downIf = await interfaceOn(container, options.clinicNetwork);
  const events: LinkEvent[] = [];
  let current: ProfileName | 'none' = 'none';
  let cutting = false;
  let cutInterrupted = false;
  // Read through a function: TypeScript would otherwise narrow it to its value before the wait.
  const wasInterrupted = () => cutInterrupted;
  const log = (event: LinkEvent['event'], detail: string) =>
    events.push({ at: new Date().toISOString(), event, detail });
  const apply = (profile: ProfileName | 'none', cut = false) =>
    docker([
      'exec',
      container,
      'apply-profile.sh',
      // A cut on an unshaped link still drops everything: P3's rates are the loosest.
      profile === 'none' && cut ? 'P3' : profile,
      upIf,
      downIf,
      ...(cut ? ['cut'] : []),
    ]);
  const counter = async (dev: string) =>
    Number(
      (await docker(['exec', container, 'cat', `/sys/class/net/${dev}/statistics/tx_bytes`]))
        .stdout,
    );

  const link: Link = {
    container,
    events,
    ...(options.sinkUrl === undefined ? {} : { sinkUrl: options.sinkUrl }),
    applyProfile: async (profile) => {
      await apply(profile);
      current = profile;
      // A profile change during a cut ends it now; the log says so (the report reads it).
      if (cutting) cutInterrupted = true;
      log('profile', cutInterrupted ? `${profile} (ended a cut)` : profile);
    },
    cut: async (seconds, options = {}) => {
      if (cutting) throw new Error('a cut is already running');
      cutting = true;
      cutInterrupted = false;
      try {
        // A dropped line (a re-dial) also ends every open connection; a plain cut only stalls.
        // Reset first, so the resets still reach the clients before every packet is dropped.
        if (options.drop) await link.reset();
        await apply(current, true);
        log('cut-start', `${String(seconds)} s${options.drop ? ', connections dropped' : ''}`);
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        if (wasInterrupted()) {
          log('cut-end', 'interrupted by a profile change');
        } else {
          await apply(current);
          log('cut-end', current);
        }
      } finally {
        cutting = false;
      }
    },
    reset: async () => {
      await docker(['exec', container, 'pkill', '-x', 'haproxy']);
      log('reset', 'haproxy restarted');
    },
    counters: async () => ({ upBytes: await counter(upIf), downBytes: await counter(downIf) }),
    schedule: ({ everySeconds, cutSeconds, offsetSeconds }) => {
      let stopped = false;
      let timer: NodeJS.Timeout | undefined;
      let running: Promise<void> = Promise.resolve();
      const next = (delay: number) => {
        timer = setTimeout(() => {
          if (stopped) return;
          // A failed cut (container gone at teardown) ends the schedule instead of rejecting.
          running = link
            .cut(cutSeconds, { drop: true })
            .then(() => {
              if (!stopped) next((everySeconds - cutSeconds) * 1000);
            })
            .catch(() => {
              stopped = true;
            });
        }, delay);
      };
      next(offsetSeconds * 1000);
      // Stopping waits for a cut in progress to end, so the link is back on its profile.
      return async () => {
        stopped = true;
        clearTimeout(timer);
        await running;
      };
    },
  };
  return link;
}
