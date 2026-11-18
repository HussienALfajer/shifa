// Playback (VOX-12, VOX-18): a call becomes a list of decoded clips scheduled back to back on one
// AudioContext, each start(t) at the previous end. A missing name clip drops only the name; a
// missing number or room clip leaves the chime; no pack (or no chime) leaves an oscillator tone.
import type { Call } from './queue.ts';

export type PlayMode = 'full' | 'number-only' | 'chime-only' | 'oscillator';

export const numberClipId = (n: number) => `number-${String(n).padStart(3, '0')}`;
export const roomClipId = (room: number) => `room-${String(room)}`;

export interface Choice {
  mode: PlayMode;
  clipIds: string[];
}

export function chooseClips(call: Call, has: (clipId: string) => boolean): Choice {
  if (!has('chime')) return { mode: 'oscillator', clipIds: ['oscillator'] };
  const number = numberClipId(call.number);
  const room = roomClipId(call.room);
  if (!has(number) || !has(room)) return { mode: 'chime-only', clipIds: ['chime'] };
  if (call.nameClipId === undefined) return { mode: 'full', clipIds: ['chime', number, room] };
  if (!has(call.nameClipId)) return { mode: 'number-only', clipIds: ['chime', number, room] };
  return { mode: 'full', clipIds: ['chime', call.nameClipId, number, room] };
}

/** Back-to-back start times from `startAt` (seconds); the end is the last start plus its length. */
export function planSchedule(
  durations: number[],
  startAt: number,
): { starts: number[]; end: number } {
  const starts: number[] = [];
  let t = startAt;
  for (const d of durations) {
    starts.push(t);
    t += d;
  }
  return { starts, end: t };
}

export interface Scheduled {
  starts: number[];
  durations: number[];
  end: number;
  ended: Promise<void>;
}

const OSC_TONES = [
  { hz: 659.25, s: 0.4 },
  { hz: 523.25, s: 0.4 },
];

/** The fallback chime when even the chime clip is missing: two oscillator tones. */
function scheduleOscillator(ctx: BaseAudioContext, startAt: number): Scheduled {
  const durations = OSC_TONES.map((t) => t.s);
  const { starts, end } = planSchedule(durations, startAt);
  let last: OscillatorNode | undefined;
  OSC_TONES.forEach((tone, i) => {
    const t0 = starts[i] ?? startAt;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = tone.hz;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
    gain.gain.setValueAtTime(0.3, t0 + tone.s - 0.01);
    gain.gain.linearRampToValueAtTime(0, t0 + tone.s);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + tone.s);
    last = osc;
  });
  return { starts, durations, end, ended: endedOf(last) };
}

function endedOf(node: AudioScheduledSourceNode | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (!node) {
      resolve();
      return;
    }
    node.addEventListener('ended', () => {
      resolve();
    });
  });
}

export function scheduleClips(
  ctx: BaseAudioContext,
  buffers: ReadonlyMap<string, AudioBuffer>,
  choice: Choice,
  startAt: number,
): Scheduled {
  if (choice.mode === 'oscillator') return scheduleOscillator(ctx, startAt);
  const list = choice.clipIds.map((id) => {
    const buffer = buffers.get(id);
    if (!buffer) throw new Error(`clip not decoded: ${id}`);
    return buffer;
  });
  const durations = list.map((b) => b.duration);
  const { starts, end } = planSchedule(durations, startAt);
  let last: AudioBufferSourceNode | undefined;
  list.forEach((buffer, i) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(starts[i] ?? startAt);
    last = source;
  });
  return { starts, durations, end, ended: endedOf(last) };
}

/** Renders clips offline exactly as scheduled and measures the longest silence (< -60 dBFS). */
export async function renderOffline(
  buffers: ReadonlyMap<string, AudioBuffer>,
  clipIds: string[],
  sampleRate: number,
): Promise<{ longestSilenceMs: number; totalMs: number }> {
  const total = clipIds.reduce((sum, id) => sum + (buffers.get(id)?.duration ?? 0), 0);
  const offline = new OfflineAudioContext(1, Math.ceil(total * sampleRate), sampleRate);
  scheduleClips(offline, buffers, { mode: 'full', clipIds }, 0);
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  let longest = 0;
  let run = 0;
  for (const x of data) {
    run = Math.abs(x) < 0.001 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { longestSilenceMs: (longest / sampleRate) * 1000, totalMs: total * 1000 };
}
