// Standalone fake WAHA for manual runs (0.3-S5b tooling): configuration from the environment,
// faults over POST /__fake/<method>.
import { startFakeWaha } from './index.ts';

const need = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

const fake = await startFakeWaha({
  container: need('FAKE_WAHA_CONTAINER'),
  apiKey: need('FAKE_WAHA_API_KEY'),
  hmacKey: need('FAKE_WAHA_HMAC_KEY'),
  webhookUrl: need('FAKE_WAHA_WEBHOOK_URL'),
  port: Number(process.env['PORT'] ?? '3000'),
  log: (line) => process.stdout.write(`${line}\n`),
});
process.stdout.write(`${JSON.stringify({ event: 'fake_waha_listening', url: fake.url })}\n`);
