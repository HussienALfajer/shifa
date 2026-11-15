// Starts the scenario stack for ENGINE (default outbox) and hands its URLs to the test workers
// through the environment. Returns the teardown.
import { type Engine, startStack } from './harness/stack.ts';

const ENGINES: Engine[] = ['outbox', 'powersync', 'stub-drop', 'stub-dup'];

export default async function globalSetup(): Promise<() => Promise<void>> {
  const engine = (process.env['ENGINE'] ?? 'outbox') as Engine;
  if (!ENGINES.includes(engine)) throw new Error(`ENGINE must be one of ${ENGINES.join(', ')}`);
  const stack = await startStack(engine);
  Object.assign(process.env, stack.env);
  return () => stack.stop();
}
