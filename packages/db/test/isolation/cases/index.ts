// Every tenant table's isolation case (0.2-06b). Add one file per tenant table next to this
// index (see /rls-policy) and list it here; the coverage test fails until you do.
import type { IsolationCase } from '../define.ts';

export const ISOLATION_CASES: readonly IsolationCase[] = [];
