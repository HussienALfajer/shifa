// The voice pack (criterion 7): the manifest and every ok clip, fetched through the service worker
// (cache first) and decoded once into AudioBuffers at load (VOX-12). VOX-11: when online, the
// cached manifest is compared with the network copy; the difference is reported only.

export interface PackClip {
  clipId: string;
  file: string;
  sha256: string | null;
  status: 'ok' | 'failed';
}

export interface PackManifest {
  packVersion: string;
  clips: PackClip[];
}

export interface Pack {
  manifest: PackManifest;
  buffers: Map<string, AudioBuffer>;
}

export interface PackDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export const manifestUrl = (packDir: string) => `/${packDir}/manifest.json`;

export async function loadPack(ctx: BaseAudioContext, packDir: string): Promise<Pack | null> {
  const res = await fetch(manifestUrl(packDir)).catch(() => null);
  if (!res?.ok) return null;
  const manifest = (await res.json()) as PackManifest;
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(
    manifest.clips
      .filter((c) => c.status === 'ok')
      .map(async (clip) => {
        // A clip that is missing or will not decode is skipped; it falls back at play time.
        try {
          const audio = await fetch(`/${packDir}/${clip.file}`);
          if (!audio.ok) return;
          buffers.set(clip.clipId, await ctx.decodeAudioData(await audio.arrayBuffer()));
        } catch {
          // skipped
        }
      }),
  );
  return { manifest, buffers };
}

export function diffManifests(cached: PackManifest, network: PackManifest): PackDiff {
  const a = new Map(cached.clips.map((c) => [c.clipId, c.sha256]));
  const b = new Map(network.clips.map((c) => [c.clipId, c.sha256]));
  return {
    added: [...b.keys()].filter((id) => !a.has(id)),
    removed: [...a.keys()].filter((id) => !b.has(id)),
    changed: [...b].filter(([id, sha]) => a.has(id) && a.get(id) !== sha).map(([id]) => id),
  };
}

/** How many clips of the pack sit in Cache Storage (what survives a restart with no network). */
export async function cachedClipCount(manifest: PackManifest): Promise<number> {
  if (!('caches' in window)) return 0;
  const cache = await caches.open(`s6-pack-${manifest.packVersion}`);
  const keys = await cache.keys();
  return keys.filter((r) => r.url.endsWith('.wav')).length;
}

/** The network copy of the manifest, past the service worker; null when offline. */
export async function networkManifest(packDir: string): Promise<PackManifest | null> {
  try {
    const res = await fetch(`${manifestUrl(packDir)}?network=1`, { cache: 'no-store' });
    return res.ok ? ((await res.json()) as PackManifest) : null;
  } catch {
    return null;
  }
}
