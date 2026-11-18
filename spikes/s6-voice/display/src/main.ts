// The kiosk display page (criteria 7-8). Spike only: calls arrive through the test hook
// (window.__s6.call) or the local control page over BroadcastChannel, never a server.
// URL parameters: pack=<dir> (default "pack"), delayPackMs=<ms> (test knob: a slow pack download).
import { flash } from './flash.ts';
import { startGate } from './gate.ts';
import { events, logEvent } from './log.ts';
import {
  cachedClipCount,
  diffManifests,
  loadPack,
  networkManifest,
  type Pack,
  type PackDiff,
} from './pack.ts';
import { chooseClips, renderOffline, scheduleClips } from './player.ts';
import { type Call, CallQueue, createSeenStore } from './queue.ts';
import { startWakeLock } from './wakelock.ts';

const params = new URLSearchParams(location.search);
// A pack is a folder name on this origin only (`?pack=/evil.example/x` would load another site).
const packParam = params.get('pack') ?? 'pack';
const packDir = /^[a-z0-9-]{1,40}$/u.test(packParam) ? packParam : 'invalid-pack';
const delayPackMs = Number(params.get('delayPackMs') ?? '0');

const ctx = new AudioContext();
let status: 'loading' | 'ready' | 'no-pack' = 'loading';
let pack: Pack | null = null;
let packDiff: PackDiff | null = null;
const latency = { loadToReadyMs: null as number | null, callToStartMs: null as number | null };
const arrivals = new Map<string, number>();
let cachedClips: number | null = null;

const queue = new CallQueue({ now: () => Date.now(), seen: createSeenStore(sessionStorage) });
const gate = startGate(ctx, () => {
  render();
  pump();
});
const wakeLock = startWakeLock(() => {
  render();
});

function state() {
  return {
    status,
    audio: ctx.state,
    gate: gate.shown(),
    packVersion: pack?.manifest.packVersion ?? null,
    clipCount: pack?.buffers.size ?? 0,
    cachedClips,
    queued: queue.length,
    playing: queue.current?.callId ?? null,
    latency: { ...latency },
    wakeLock: { ...wakeLock },
    packDiff,
  };
}

function render(): void {
  const el = document.querySelector('[data-testid="status"]');
  if (!el) return;
  const wl = wakeLock.held ? 'held' : (wakeLock.error ?? 'released');
  const ms = (v: number | null) => (v === null ? '–' : `${String(Math.round(v))} ms`);
  el.textContent = [
    `pack: ${status}${pack ? ` ${pack.manifest.packVersion}` : ''}`,
    `clips decoded/cached: ${String(pack?.buffers.size ?? 0)}/${cachedClips === null ? '–' : String(cachedClips)}`,
    `audio: ${ctx.state}`,
    `Wake Lock: ${wl}`,
    `load→ready: ${ms(latency.loadToReadyMs)}`,
    `call→start: ${ms(latency.callToStartMs)}`,
    `queue: ${String(queue.length)}`,
  ].join(' · ');
}

function pump(): void {
  if (status === 'loading' || ctx.state !== 'running') return;
  const next = queue.next(ctx.currentTime * 1000);
  if (!next) return;
  const { call, startAtMs } = next;
  const buffers = pack?.buffers ?? new Map<string, AudioBuffer>();
  const choice = chooseClips(call, (id) => buffers.has(id));
  const startAt = startAtMs / 1000;
  const scheduled = scheduleClips(ctx, buffers, choice, startAt);
  const arrived = arrivals.get(call.callId) ?? performance.now();
  latency.callToStartMs = performance.now() - arrived + (startAt - ctx.currentTime) * 1000;
  logEvent('scheduled', {
    callId: call.callId,
    mode: choice.mode,
    clipIds: choice.clipIds,
    starts: scheduled.starts,
    durations: scheduled.durations,
    end: scheduled.end,
  });
  flash(call.callId, call.number, call.room);
  render();
  void scheduled.ended.then(() => {
    queue.finished(call.callId, scheduled.end * 1000);
    logEvent('played', { callId: call.callId, mode: choice.mode });
    render();
    pump();
  });
}

function receive(call: Call): void {
  const arrivedAt = performance.now();
  const result = queue.offer(call);
  if (result.accepted) {
    arrivals.set(call.callId, arrivedAt);
    logEvent('queued', { callId: call.callId });
  } else {
    logEvent('dropped', { callId: call.callId, reason: result.reason });
  }
  render();
  pump();
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    // Not a secure context (e.g. http://10.0.2.2 from an emulator): no cache, no Wake Lock.
    logEvent('sw-unavailable', { secureContext: window.isSecureContext });
    return;
  }
  try {
    await navigator.serviceWorker.register(`/sw.js?pack=${encodeURIComponent(packDir)}`);
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 15_000)),
    ]);
    // The page shell (the page and every script it loaded), so a reload with the network off
    // still opens the page. Skipped offline: the shell is already cached then.
    if (!navigator.onLine) return;
    const shell = await caches.open('s6-shell');
    const assets = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((url) => url.startsWith(`${location.origin}/assets/`));
    await shell.addAll(['/', '/control.html', ...new Set(assets)]);
  } catch (error) {
    logEvent('sw-failed', { error: error instanceof Error ? error.name : 'error' });
  }
}

async function start(): Promise<void> {
  render();
  await registerServiceWorker();
  if (delayPackMs > 0) await new Promise((resolve) => setTimeout(resolve, delayPackMs));
  pack = await loadPack(ctx, packDir).catch(() => null);
  status = pack ? 'ready' : 'no-pack';
  latency.loadToReadyMs = performance.now();
  logEvent(status === 'ready' ? 'pack-ready' : 'pack-failed', {
    packVersion: pack?.manifest.packVersion ?? null,
    clips: pack?.buffers.size ?? 0,
  });
  render();
  pump();
  if (pack) {
    cachedClips = await cachedClipCount(pack.manifest).catch(() => 0);
    render();
  }
  if (pack && navigator.onLine) {
    const network = await networkManifest(packDir);
    if (network) {
      packDiff = diffManifests(pack.manifest, network);
      logEvent('pack-diff', { ...packDiff });
    }
  }
}

// The test hook (typed by the e2e helpers).
(window as unknown as { __s6: unknown }).__s6 = {
  call: receive,
  state,
  events,
  renderOffline: (clipIds: string[]) =>
    renderOffline(pack?.buffers ?? new Map<string, AudioBuffer>(), clipIds, ctx.sampleRate),
};

new BroadcastChannel('s6-calls').addEventListener('message', (e: MessageEvent<Call>) => {
  receive(e.data);
});

void start();
