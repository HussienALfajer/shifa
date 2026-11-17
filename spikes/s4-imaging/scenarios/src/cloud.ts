// Cloud-side checks from the clinic side, through the gateway (no ops tunnel): the instances of
// a study in a tenant, read back by WADO-RS with a viewer token, as SHA-256 per SOP Instance UID.
// The caller unshapes the link first when it only wants the answer, not the timing.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cacheDir, repoRoot } from '@shifa-spike/s4-generator';
import { datasetSha256, multipartParts, type Stack, stowBody } from '@shifa-spike/s4-stack';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

async function asViewer(stack: Stack, tenant: 'a' | 'b', path: string, accept: string) {
  const token = await stack.token({ sub: `check-${tenant}`, tenant, role: 'viewer' });
  return fetch(`${stack.gatewayUrl}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept },
  });
}

/**
 * SOP Instance UID → SHA-256 of every instance of the study in the tenant: of the whole file,
 * or of its dataset after the file meta group (`dataset`, for copies that crossed a C-STORE).
 */
export async function cloudStudy(
  stack: Stack,
  tenant: 'a' | 'b',
  studyUid: string,
  hash: 'file' | 'dataset' = 'file',
): Promise<Map<string, string>> {
  const list = await asViewer(
    stack,
    tenant,
    `/dicomweb/studies/${studyUid}/instances`,
    'application/dicom+json',
  );
  const found = new Map<string, string>();
  if (list.status === 204 || list.status === 404) return found;
  if (list.status !== 200) throw new Error(`QIDO ${String(list.status)}`);
  const rows = (await list.json()) as Record<string, { Value?: string[] } | undefined>[];
  for (const row of rows) {
    const series = row['0020000E']?.Value?.[0] ?? '';
    const sop = row['00080018']?.Value?.[0] ?? '';
    const res = await asViewer(
      stack,
      tenant,
      `/dicomweb/studies/${studyUid}/series/${series}/instances/${sop}`,
      'multipart/related; type="application/dicom"; transfer-syntax=*',
    );
    if (res.status !== 200) throw new Error(`WADO ${String(res.status)}`);
    const body = new Uint8Array(await res.arrayBuffer());
    const [part] = multipartParts(body, res.headers.get('content-type') ?? '');
    const bytes = part ?? new Uint8Array();
    found.set(sop, hash === 'file' ? sha256(bytes) : datasetSha256(bytes));
  }
  return found;
}

/** Number of instances of the study the tenant lists (QIDO-RS only, nothing downloaded). */
export async function cloudCount(
  stack: Stack,
  tenant: 'a' | 'b',
  studyUid: string,
): Promise<number> {
  const list = await asViewer(
    stack,
    tenant,
    `/dicomweb/studies/${studyUid}/instances`,
    'application/dicom+json',
  );
  if (list.status === 204 || list.status === 404) return 0;
  if (list.status !== 200) throw new Error(`QIDO ${String(list.status)}`);
  return ((await list.json()) as unknown[]).length;
}

/** Stores files into a tenant by STOW-RS through the gateway (setup for viewing tests). */
export async function stowFiles(
  stack: Stack,
  tenant: 'a' | 'b',
  dir: string,
  paths: readonly string[],
): Promise<void> {
  const token = await stack.token({ sub: `setup-${tenant}`, tenant, role: 'uploader' });
  for (let i = 0; i < paths.length; i += 16) {
    const files = await Promise.all(paths.slice(i, i + 16).map((p) => readFile(join(dir, p))));
    const { body, contentType } = stowBody(files);
    const res = await fetch(`${stack.gatewayUrl}/dicomweb/studies`, {
      method: 'POST',
      body: new Uint8Array(body),
      headers: { authorization: `Bearer ${token}`, 'content-type': contentType },
    });
    await res.arrayBuffer();
    if (res.status !== 200) throw new Error(`STOW ${String(res.status)}`);
  }
}

/** Appends one result row to `.verify/s4/<file>.json` (no tags, names or tokens). */
export async function record(file: string, row: Record<string, unknown>): Promise<void> {
  const path = join(repoRoot(), '.verify', 's4', `${file}.json`);
  await mkdir(dirname(path), { recursive: true });
  let rows: unknown[];
  try {
    rows = JSON.parse(await readFile(path, 'utf8')) as unknown[];
  } catch {
    rows = [];
  }
  rows.push({ at: new Date().toISOString(), ...row });
  await writeFile(path, `${JSON.stringify(rows, null, 2)}\n`);
}

export const LONG = process.env['S4_LONG'] === '1';
export { cacheDir };
