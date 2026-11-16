// The one command handler both engines upload through (spec criterion 1). Per command, one
// withTenant() transaction: a stored result is returned as is (replay, SCH-13); otherwise the
// command is validated, applied and its result stored. Server time is taken on receipt.
import type { ShifaDb, Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';
import type { Principal } from '../auth.ts';
import { Command, CommandEnvelope, type CommandResult } from '../commands.ts';
import type { Logger } from '../log.ts';
import { MESSAGES, type ReasonCode, Refusal } from './messages.ts';
import { applyRule } from './rules.ts';

export interface HandlerDeps {
  db: ShifaDb;
  log: Logger;
}

const EXCLUSION_VIOLATION = '23P01';

function sqlState(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}

function reason(id: string, status: 'conflict' | 'refused', code: ReasonCode): CommandResult {
  return {
    id,
    status,
    conflict: { code, messageAr: MESSAGES[code] },
    serverTime: new Date().toISOString(),
  };
}

async function lockAndFind(
  tx: Tx,
  principal: Principal,
  id: string,
): Promise<CommandResult | undefined> {
  // Two concurrent posts of one id wait here; the second then finds the stored result.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`s1c:${principal.tenantId}:${id}`}, 0))`,
  );
  const { rows } = await tx.execute<{ result: CommandResult }>(
    sql`select result from s1.offline_command where id = ${id}`,
  );
  return rows[0]?.result;
}

async function store(
  tx: Tx,
  principal: Principal,
  command: Command,
  result: CommandResult,
): Promise<void> {
  await tx.execute(
    sql`insert into s1.offline_command (id, branch_id, device_id, user_id, type, result, client_time)
        values (${command.id}, ${principal.branchId}, ${command.deviceId}, ${principal.sub}, ${command.type},
                ${JSON.stringify(result)}::jsonb, ${command.clientTime}::timestamptz)`,
  );
}

function context(principal: Principal) {
  return { tenantId: principal.tenantId, branchId: principal.branchId, userId: principal.sub };
}

async function handleOne(
  deps: HandlerDeps,
  principal: Principal,
  command: Command,
): Promise<CommandResult> {
  try {
    return await deps.db.withTenant(context(principal), async (tx) => {
      const stored = await lockAndFind(tx, principal, command.id);
      if (stored) return stored;
      let result: CommandResult;
      try {
        const applied = await applyRule(tx, principal, command);
        result = {
          id: command.id,
          status: 'applied',
          ...applied,
          serverTime: new Date().toISOString(),
        };
      } catch (err) {
        // Only rule refusals are caught here; they are decided before any write fails.
        if (!(err instanceof Refusal)) throw err;
        result = reason(command.id, 'refused', err.code);
      }
      await store(tx, principal, command, result);
      return result;
    });
  } catch (err) {
    const code = sqlState(err) ?? '';
    // SCH-14: the overlap rolled the transaction back; store the conflict in a new one. A data or
    // integrity error (classes 22, 23) is this command's fault: store it as refused, so one bad
    // command cannot block a device's queue forever. Anything else (transient) fails the batch.
    let result: CommandResult;
    if (code === EXCLUSION_VIOLATION)
      result = reason(command.id, 'conflict', 'appointment_overlap');
    else if (code.startsWith('22') || code.startsWith('23')) {
      result = reason(command.id, 'refused', 'invalid_command');
    } else throw err;
    return deps.db.withTenant(context(principal), async (tx) => {
      const stored = await lockAndFind(tx, principal, command.id);
      if (stored) return stored;
      await store(tx, principal, command, result);
      return result;
    });
  }
}

/** Applies a batch in order and returns one result per command. */
export async function handleBatch(
  deps: HandlerDeps,
  principal: Principal,
  raw: readonly unknown[],
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];
  for (const item of raw) {
    const envelope = CommandEnvelope.safeParse(item);
    const parsed = Command.safeParse(item);
    let result: CommandResult;
    if (!parsed.success) {
      result = reason(envelope.success ? envelope.data.id : '', 'refused', 'invalid_command');
    } else if (principal.deviceId !== undefined && parsed.data.deviceId !== principal.deviceId) {
      // A token bound to a device may only send that device's commands (not stored, so nothing
      // lands in another device's results).
      result = reason(parsed.data.id, 'refused', 'forbidden');
    } else {
      result = await handleOne(deps, principal, parsed.data);
    }
    if (result.status !== 'applied') {
      deps.log({
        event: result.status === 'conflict' ? 'command_conflict' : 'command_refused',
        tenantId: principal.tenantId,
        commandId: result.id,
        code: result.conflict?.code ?? 'unknown',
      });
    }
    results.push(result);
  }
  return results;
}
