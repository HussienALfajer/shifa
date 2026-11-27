// A chart's name key and name tokens (spec A-03 criterion 5; ADR-0034, ADR-0052). Written by the
// chart repository in the transaction that saves the chart: on registration, on every edit that
// changes a name part, and for charts saved before the tokens existed (`name_key_version` 0) or
// under an older key version, before a clinic's search reads them. The key is computed here in
// TypeScript, never in SQL (ADR-0034).
import { NAME_KEY_VERSION, nameTokens, normaliseName, patientDisplayName } from '@shifa/contracts';
import { patient, patientNameToken, type Tx } from '@shifa/db';
import { eq, lt } from 'drizzle-orm';

interface NameParts {
  id: string;
  tenantId: string;
  givenName: string;
  fatherName: string | null;
  familyName: string | null;
}

/** Rewrites the chart's tokens and stores its key at the current version. */
export async function writeNameKey(tx: Tx, chart: NameParts): Promise<void> {
  await tx.delete(patientNameToken).where(eq(patientNameToken.patientId, chart.id));
  const tokens = nameTokens([chart.givenName, chart.fatherName, chart.familyName]);
  if (tokens.length > 0) {
    await tx
      .insert(patientNameToken)
      .values(
        tokens.map((t) => ({
          tenantId: chart.tenantId,
          patientId: chart.id,
          part: t.part,
          word: t.word,
          token: t.token,
          whole: t.whole,
          keyVersion: NAME_KEY_VERSION,
        })),
      )
      .onConflictDoNothing();
  }
  await tx
    .update(patient)
    .set({ nameKey: normaliseName(patientDisplayName(chart)), nameKeyVersion: NAME_KEY_VERSION })
    .where(eq(patient.id, chart.id));
}

/** Charts whose key is missing or older, written in batches; returns how many were written. */
export async function backfillNameKeys(tx: Tx, batch = 500): Promise<number> {
  let written = 0;
  for (;;) {
    // SKIP LOCKED: two searches of one clinic at once share the work instead of waiting.
    const rows = await tx
      .select({
        id: patient.id,
        tenantId: patient.tenantId,
        givenName: patient.givenName,
        fatherName: patient.fatherName,
        familyName: patient.familyName,
      })
      .from(patient)
      .where(lt(patient.nameKeyVersion, NAME_KEY_VERSION))
      .limit(batch)
      .for('update', { skipLocked: true });
    for (const row of rows) await writeNameKey(tx, row);
    written += rows.length;
    if (rows.length < batch) return written;
  }
}

/** True when a name part differs between two versions of a chart. */
export function namesChanged(before: NameParts, after: Partial<NameParts>): boolean {
  return (['givenName', 'fatherName', 'familyName'] as const).some(
    (key) => key in after && after[key] !== before[key],
  );
}
