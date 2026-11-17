// After the manual run (criterion 11): scrubs every raw capture in `.cache/s5/raw/` into
// `spikes/s5-whatsapp/fixtures/`, deletes the raw files, then runs the fixture check.
import { FIXTURES_DIR, RAW_DIR, readEnvLocal } from '../src/env-local.ts';
import { checkFixtures, scrubCaptures } from '../src/scrub.ts';

const env = readEnvLocal();
const { fixtures } = scrubCaptures({
  rawDir: RAW_DIR,
  outDir: FIXTURES_DIR,
  hmacKeys: {
    platform: env['S5_WAHA_PLATFORM_HMAC_KEY'] ?? '',
    clinics: env['S5_WAHA_CLINICS_HMAC_KEY'] ?? '',
  },
});
process.stdout.write(`scrubbed ${String(fixtures.length)} captures\n`);
const problems = checkFixtures(FIXTURES_DIR);
for (const p of problems) process.stderr.write(`${p}\n`);
process.exit(problems.length === 0 ? 0 : 1);
