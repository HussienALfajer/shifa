// Criterion 6: joins the owner's results with the key and writes the report table.
// CLI: node src/analyse.ts --results <results.json> --key <listening-key.json> [--out <dir>]
//      node src/analyse.ts --pre-round --results <pre-round-choice.json> --key <pre-round-key.json>
// Output is deterministic (no clock, no random): rerunning on the committed files reproduces it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  type ListeningKey,
  type ListeningResults,
  listeningKeySchema,
  listeningResultsSchema,
  preRoundChoiceSchema,
} from '@shifa-spike/s6-tts';
import { type Decision, decide, type Stat, type Summary, summarise } from './rule.ts';

export interface Analysis extends Summary {
  setHash: string;
  seed: number;
  startedAt: string;
  finishedAt: string;
  decision: Decision;
}

export function analyse(results: ListeningResults, key: ListeningKey): Analysis {
  if (results.setHash !== key.setHash) {
    throw new Error(`set hash differs: results ${results.setHash}, key ${key.setHash}`);
  }
  const summary = summarise(results, key);
  return {
    setHash: key.setHash,
    seed: key.seed,
    startedAt: results.startedAt,
    finishedAt: results.finishedAt,
    ...summary,
    decision: decide(summary.voices),
  };
}

const fmt = (s: Stat | undefined) =>
  s && s.n > 0 ? `${s.mean.toFixed(2)} (n=${String(s.n)}, sd=${s.sd.toFixed(2)})` : '—';
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function decisionText(d: Decision): string {
  switch (d.kind) {
    case 'winner': {
      const parts = [`**Winner: ${d.voiceId}** (${d.reason}).`];
      if (d.runnerUp) parts.push(`Runner-up ${d.runnerUp}, margin ${d.margin.toFixed(3)}.`);
      if (d.excluded) parts.push(`Passed over for a wrong number: ${d.excluded.join(', ')}.`);
      return parts.join(' ');
    }
    case 'accepted':
      return `**Accepted: ${d.voiceId}** (OD-51: ${d.reason}).`;
    case 'not-accepted':
      return `**Not accepted: ${d.voiceId}** (OD-51: ${d.reason}).${d.wrongNumbers.length > 0 ? `\nWrong numbers: ${d.wrongNumbers.join(', ')}` : ''}`;
    case 'tie':
      return `**Tie** between ${d.voiceIds.join(', ')}: same mean naturalness (within 0.05) and same number of wrong names. The owner decides.`;
    case 'no-eligible-winner':
      return [
        '**No eligible winner**: every voice has a wrong number. Regenerate these with a corrected text and confirm with the owner (OD-50):',
        ...d.wrongNumbers.map((w) => `- ${w.voiceId}: ${w.clipIds.join(', ')}`),
      ].join('\n');
  }
}

export function toMarkdown(a: Analysis): string {
  const categories = [
    ...new Set(a.voices.flatMap((v) => Object.keys(v.naturalness.byCategory))),
  ].sort();
  const lines = [
    '# S6 listening test: analysis',
    '',
    `Set ${a.setHash} (seed ${String(a.seed)}), listened ${a.startedAt} to ${a.finishedAt}; ${String(a.ratedClips)} clips rated, ${String(a.pairsJudged)} pairs judged.`,
    'One listener (OD-50): means describe the owner’s ratings; no significance claim is made.',
    '',
    '## Decision (OD-50)',
    '',
    decisionText(a.decision),
    '',
    '## Naturalness (1-5): mean (n, sd)',
    '',
    `| voice | all | ${categories.join(' | ')} |`,
    `|---|---|${categories.map(() => '---').join('|')}|`,
    ...a.voices.map(
      (v) =>
        `| ${v.voiceId} | ${fmt(v.naturalness.all)} | ${categories.map((c) => fmt(v.naturalness.byCategory[c])).join(' | ')} |`,
    ),
    '',
    '## Wrong numbers and names',
    '',
    '| voice | wrong numbers | wrong names |',
    '|---|---|---|',
    ...a.voices.map(
      (v) => `| ${v.voiceId} | ${String(v.wrongNumbers.length)} | ${String(v.wrongNames.length)} |`,
    ),
    '',
  ];
  for (const v of a.voices) {
    for (const w of [...v.wrongNumbers, ...v.wrongNames]) {
      lines.push(`- ${v.voiceId} ${w.clipId} «${w.text}»${w.note ? `: ${w.note}` : ''}`);
    }
  }
  lines.push(
    '',
    '## Pairs (full announcements)',
    '',
    '| voice | wins | losses | ties |',
    '|---|---|---|---|',
    ...a.voices.map(
      (v) =>
        `| ${v.voiceId} | ${String(v.pairs.wins)} | ${String(v.pairs.losses)} | ${String(v.pairs.ties)} |`,
    ),
    '',
    '## Tashkeel: names heard in both forms (VOX-08)',
    '',
    '| voice | diacritised wrong | plain wrong |',
    '|---|---|---|',
    ...[
      ...a.voices.map((v) => [v.voiceId, a.tashkeel.byVoice[v.voiceId]] as const),
      ['all voices', a.tashkeel.all] as const,
    ].map(([label, t]) =>
      t
        ? `| ${label} | ${String(t.diacritised.wrong)}/${String(t.diacritised.judged)} (${pct(t.diacritised.rate)}) | ${String(t.plain.wrong)}/${String(t.plain.judged)} (${pct(t.plain.rate)}) |`
        : `| ${label} | — | — |`,
    ),
    '',
  );
  return lines.join('\n');
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function preRound(resultsFile: string, keyFile: string, out: string): void {
  const choice = preRoundChoiceSchema.parse(readJson(resultsFile));
  const key = listeningKeySchema.parse(readJson(keyFile));
  if (key.kind !== 'pre-round') throw new Error('not a pre-round key');
  if (choice.setHash !== key.setHash) throw new Error('set hash differs: choice and key');
  const pick = (label: number, gender: 'male' | 'female') => {
    const v = key.voices.find((x) => x.label === label);
    if (v?.gender !== gender) throw new Error(`label ${String(label)} is not a ${gender} voice`);
    return v.voice;
  };
  const result = {
    male: pick(choice.male, 'male'),
    female: pick(choice.female, 'female'),
    chosenAt: choice.chosenAt,
  };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'pre-round.json'), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(
    join(out, 'pre-round.md'),
    `# S6 pre-round\n\nOwner's pick (${result.chosenAt}): male ${result.male}, female ${result.female}.\n`,
  );
}

export function main(argv: string[]): number {
  const { values } = parseArgs({
    args: argv,
    options: {
      results: { type: 'string' },
      key: { type: 'string' },
      out: { type: 'string' },
      'pre-round': { type: 'boolean', default: false },
    },
  });
  if (!values.results || !values.key) throw new Error('--results <file> --key <file>');
  const out = values.out ?? dirname(values.results);
  if (values['pre-round']) {
    preRound(values.results, values.key, out);
    return 0;
  }
  const results = listeningResultsSchema.parse(readJson(values.results));
  const key = listeningKeySchema.parse(readJson(values.key));
  const analysis = analyse(results, key);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
  writeFileSync(join(out, 'analysis.md'), toMarkdown(analysis));
  process.stdout.write(`${decisionText(analysis.decision)}\n`);
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'error'}\n`);
    process.exit(1);
  }
}
