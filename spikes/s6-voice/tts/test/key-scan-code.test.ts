// The generic key pattern skips code (`key = listeningKeySchema.parse(`) but still catches key
// values, including one at the end of a sentence (0.3-S6b review).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanForKeys } from '../src/keys.ts';
import { tempOutDir } from './helpers.ts';

// Built at run time so no key-shaped literal sits in the repository.
const VALUE = 'Zq7'.repeat(8);

function scan(line: string): string[] {
  const dir = tempOutDir();
  writeFileSync(join(dir, 'sample.txt'), `${line}\n`);
  return scanForKeys([dir]).map((f) => f.kind);
}

describe('generic key pattern and code', () => {
  it('does not flag a member access or a call', () => {
    expect(scan('const key = listeningKeySchema.parse(readJson(file));')).toEqual([]);
    expect(scan('  key: someLongIdentifierName(value),')).toEqual([]);
  });

  it('still flags assignments, JSON fields and a key at a sentence end', () => {
    expect(scan(`S6_AZURE_KEY=${VALUE}`)).toContain('generic-key');
    expect(scan(`{"apiKey": "${VALUE}"}`)).toContain('generic-key');
    expect(scan(`request failed with key=${VALUE}.`)).toContain('generic-key');
    expect(scan(`secret: ${VALUE}== trailing`)).toContain('generic-key');
  });
});
