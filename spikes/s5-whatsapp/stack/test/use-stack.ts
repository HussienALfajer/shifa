// Per-file WAHA stack: started before the file's tests, stopped after.
import { afterAll, beforeAll } from 'vitest';
import { type Stack, type StackOptions, startStack } from '../src/stack.ts';

export function useStack(options: StackOptions): Stack {
  const holder = {} as { stack?: Stack };
  beforeAll(async () => {
    holder.stack = await startStack(options);
  });
  afterAll(async () => {
    await holder.stack?.stop();
  });
  // Tests read the stack lazily (inside `it`), after beforeAll filled it.
  return new Proxy({} as Stack, {
    get(_target, key) {
      if (!holder.stack) throw new Error('stack not started');
      return Reflect.get(holder.stack, key) as unknown;
    },
  });
}
