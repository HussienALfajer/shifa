// The chart service's input helpers and its audit row (spec A-03 criteria 1, 20). Audit data holds
// ids and changed keys only: never a name, phone, date or previous number.
import { cleanPatientNamePart, normalisePhone } from '@shifa/contracts';
import { type AuditEventName, auditEvent, type Tx } from '@shifa/db';
import type { RequestScope } from '../../access/index.ts';
import { RequestValidationError } from '../../platform/contract/index.ts';

/** E.164 for a required phone; 400 on its path when invalid. */
export function phoneAt(input: string, path: string): string {
  const phone = normalisePhone(input);
  if (!phone.ok) throw new RequestValidationError([{ path, code: 'invalid_format' }]);
  return phone.e164;
}

/** `undefined`: not given; `null`: cleared; else E.164. */
export function optionalPhone(
  input: string | null | undefined,
  path: string,
): string | null | undefined {
  return input === undefined || input === null ? input : phoneAt(input, path);
}

/** `undefined`: not given; `null`: cleared; else trimmed. */
export function optionalPart(input: string | null | undefined): string | null | undefined {
  return input === undefined || input === null ? input : cleanPatientNamePart(input);
}

export const previousOf = (input: string | null | undefined) =>
  input === undefined || input === null ? input : input.trim();

export type AuditData = Record<string, boolean | readonly string[]>;

/** One row in the clinic: actor, chart, request; `data` ids or changed keys only. */
export async function audit(
  tx: Tx,
  scope: RequestScope,
  event: AuditEventName,
  targetId: string,
  requestId: string,
  data: AuditData = {},
): Promise<void> {
  await tx.insert(auditEvent).values({
    tenantId: scope.tenantId,
    actorId: scope.userId,
    targetId,
    event,
    requestId,
    data,
  });
}
