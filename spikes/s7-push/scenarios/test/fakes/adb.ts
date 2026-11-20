// Recorded-command fake of `adb` (0.3-S7b): every call is kept as one string ("-s <serial> shell
// <cmd>"), and answers come from matchers, so CI checks the commands without an emulator.
import { type Adb } from '../../src/adb.ts';

export type Answer = string | ((call: string) => string);

export interface FakeAdb extends Adb {
  readonly calls: string[];
  /** Calls after `-s <serial>`, in order, for one emulator. */
  callsFor: (serial: string) => string[];
  answer: (match: RegExp, answer: Answer) => void;
  clear: () => void;
}

export function createFakeAdb(): FakeAdb {
  const calls: string[] = [];
  const answers: [RegExp, Answer][] = [
    [/getprop sys\.boot_completed$/, '1\n'],
    [/shell dumpsys notification/, ''],
  ];
  return {
    calls,
    callsFor: (serial) =>
      calls.filter((c) => c.startsWith(`-s ${serial} `)).map((c) => c.slice(serial.length + 4)),
    answer: (match, answer) => {
      answers.unshift([match, answer]);
    },
    clear: () => {
      calls.length = 0;
    },
    exec: (args) => {
      const call = args.join(' ');
      calls.push(call);
      const hit = answers.find(([m]) => m.test(call));
      const answer = hit?.[1] ?? '';
      return Promise.resolve(typeof answer === 'function' ? answer(call) : answer);
    },
  };
}

/** A fake clock whose `sleep` advances time at once. */
export function fakeClock(startIso: string) {
  let ms = Date.parse(startIso);
  return {
    now: () => new Date(ms),
    nowMs: () => ms,
    hostNs: () => BigInt(ms) * 1_000_000n,
    sleep: (wait: number) => {
      ms += wait;
      return Promise.resolve();
    },
    advance: (wait: number) => {
      ms += wait;
    },
  };
}
