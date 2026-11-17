// Fails on any run of 8+ digits in the committed fixtures that is not a synthetic number (OD-23).
import { FIXTURES_DIR } from '../src/env-local.ts';
import { checkFixtures } from '../src/scrub.ts';

const problems = checkFixtures(FIXTURES_DIR);
for (const p of problems) process.stderr.write(`${p}\n`);
process.stdout.write(`fixture check: ${problems.length === 0 ? 'pass' : 'fail'}\n`);
process.exit(problems.length === 0 ? 0 : 1);
