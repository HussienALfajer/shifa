// Plays one clip or a joined announcement: clips decoded once, scheduled back to back on one
// AudioContext (as the display page does, VOX-12). A new play stops the one before.

export interface PlayEvent {
  type: 'play';
  codes: string[];
  /** Audio-clock seconds: start of each clip and its duration. */
  starts: number[];
  durations: number[];
}

export interface Player {
  play: (codes: string[], files: string[]) => Promise<boolean>;
  stop: () => void;
  events: PlayEvent[];
  /** True until a user gesture lets audio start (Chrome's default autoplay policy). */
  suspended: () => boolean;
}

export function createPlayer(): Player {
  const ctx = new AudioContext();
  const buffers = new Map<string, Promise<AudioBuffer>>();
  const events: PlayEvent[] = [];
  let sources: AudioBufferSourceNode[] = [];
  let generation = 0;

  const load = (code: string, file: string): Promise<AudioBuffer> => {
    let p = buffers.get(code);
    if (!p) {
      p = fetch(`./${file}`)
        .then((res) => {
          if (!res.ok) throw new Error(`clip ${code}: HTTP ${String(res.status)}`);
          return res.arrayBuffer();
        })
        .then((bytes) => ctx.decodeAudioData(bytes));
      p.catch(() => buffers.delete(code));
      buffers.set(code, p);
    }
    return p;
  };

  const stop = () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        // already ended
      }
    }
    sources = [];
  };

  /** Resolves true when the last clip ended, false when a later play or stop cut it short. */
  const play = async (codes: string[], files: string[]): Promise<boolean> => {
    generation += 1;
    const mine = generation;
    stop();
    if (ctx.state !== 'running') await ctx.resume();
    const decoded = await Promise.all(codes.map((code, i) => load(code, files[i] ?? '')));
    // A later play superseded this one while it was loading.
    if (mine !== generation) return false;
    const starts: number[] = [];
    let t = ctx.currentTime + 0.05;
    let last: AudioBufferSourceNode | undefined;
    for (const buffer of decoded) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(t);
      starts.push(t);
      sources.push(source);
      last = source;
      t += buffer.duration;
    }
    events.push({ type: 'play', codes, starts, durations: decoded.map((b) => b.duration) });
    if (!last) return true;
    const node = last;
    await new Promise<void>((resolve) => {
      node.addEventListener('ended', () => {
        resolve();
      });
    });
    return mine === generation && sources.includes(node);
  };

  return {
    play,
    stop: () => {
      generation += 1;
      stop();
    },
    events,
    suspended: () => ctx.state !== 'running',
  };
}
