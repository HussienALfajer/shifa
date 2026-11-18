// CLI: node src/cli.ts --provider <azure|google|silma|fake> [--voice <v>] [--set full|pre-round]
//      [--dry-run] [--out <dir>]
// Without --voice, every voice of the provider is generated in turn. Keys come from the
// git-ignored spikes/s6-voice/.env.local (ADR-0026); never from the command line.
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { generate } from './generate.ts';
import { ENV_FILE, OUT_DIR } from './paths.ts';
import { type ProviderName, type TtsProvider, VOICES } from './provider.ts';
import { createAzureProvider } from './providers/azure.ts';
import { createFakeProvider } from './providers/fake.ts';
import { createGoogleProvider } from './providers/google.ts';
import { createSilmaProvider } from './providers/silma.ts';

export function readEnvLocal(file = ENV_FILE): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/u.exec(line);
    const value = m?.[2]?.replace(/^(['"])(.*)\1$/u, '$2');
    if (m?.[1] && value) out[m[1]] = value;
  }
  return out;
}

function need(env: Record<string, string>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set in spikes/s6-voice/.env.local`);
  return value;
}

export function makeProvider(name: ProviderName, env: Record<string, string>): TtsProvider {
  switch (name) {
    case 'azure':
      return createAzureProvider({
        key: need(env, 'S6_AZURE_KEY'),
        region: need(env, 'S6_AZURE_REGION'),
      });
    case 'google':
      return createGoogleProvider({ key: need(env, 'S6_GOOGLE_KEY') });
    case 'silma':
      return createSilmaProvider({ endpoint: env['S6_SILMA_URL'] ?? 'http://127.0.0.1:8088' });
    case 'fake':
      return createFakeProvider();
  }
}

async function main(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      provider: { type: 'string' },
      voice: { type: 'string' },
      set: { type: 'string', default: 'full' },
      'dry-run': { type: 'boolean', default: false },
      out: { type: 'string', default: OUT_DIR },
    },
  });
  const name = values.provider as ProviderName | undefined;
  if (!name || !(name in VOICES)) throw new Error('--provider azure|google|silma|fake');
  if (values.set !== 'full' && values.set !== 'pre-round') throw new Error('--set full|pre-round');
  // A dry run counts characters only: it needs no key and never calls the provider.
  const provider: TtsProvider = values['dry-run']
    ? { name, synthesize: () => Promise.reject(new Error('dry run')) }
    : makeProvider(name, readEnvLocal());
  const voices = values.voice ? [values.voice] : VOICES[name];
  let exitCode = 0;
  for (const voice of voices) {
    const result = await generate({
      provider,
      voice,
      set: values.set,
      outDir: values.out,
      dryRun: values['dry-run'],
      log: (line) => process.stdout.write(`${line}\n`),
    });
    exitCode = Math.max(exitCode, result.exitCode);
    if (result.exitCode === 2 || result.exitCode === 3) break;
  }
  return exitCode;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      // Messages are ours (no response body, no key); print the message only.
      process.stderr.write(`${error instanceof Error ? error.message : 'error'}\n`);
      process.exit(1);
    },
  );
}
