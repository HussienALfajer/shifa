// The OD-52 pass mark (criterion 8), in code: FCM stays primary if every graded state and the
// one-day run have at least 95% of pushes shown within 60 s, no message is lost in any run (lost =
// neither shown nor in the inbox), and every excluded state is detectable from the device state
// or by "last seen". Recorded runs (pending limit, the noshow instance) are reported, not graded.
import { type RunResult, type Verdict } from './types.ts';

export const PASS_PCT = 95;

export function evaluate(results: RunResult[]): Verdict {
  const reasons: string[] = [];
  const graded = results.filter((r) => r.grading === 'graded');
  if (results.length === 0) reasons.push('no run');
  for (const r of graded) {
    if (r.within60Pct < PASS_PCT)
      reasons.push(
        `${r.state} (${r.run}): ${String(r.within60Pct)}% shown within 60 s, below ${String(PASS_PCT)}%`,
      );
  }
  for (const r of results) {
    if (r.lost.length > 0) reasons.push(`${r.state} (${r.run}): lost ${r.lost.join(', ')}`);
    if (r.grading === 'excluded' && (r.detectability ?? 'not detectable') === 'not detectable')
      reasons.push(`${r.state} (${r.run}): not detectable from the device state`);
  }
  return { pass: reasons.length === 0, reasons };
}
