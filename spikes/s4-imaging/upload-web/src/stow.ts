// STOW-RS per instance (the DICOMweb baseline for the comparison): each file in its own request,
// up to six in parallel, each retried with exponential backoff and jitter, six attempts at most.
// After a reload the page asks QIDO which instances the study already has and skips them.
import dicomParser from 'dicom-parser';
import type { Item } from './manifest.ts';
import { backoff, interrupted, report, stats, token } from './stats.ts';

const PARALLEL = 6;
const ATTEMPTS = 6;

/** Study and SOP Instance UIDs from the start of the file (stops before the pixel data). */
async function uids(file: File): Promise<{ study: string; sop: string }> {
  const head = new Uint8Array(await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer());
  const data = dicomParser.parseDicom(head, { untilTag: 'x7fe00010' });
  return { study: data.string('x0020000d') ?? '', sop: data.string('x00080018') ?? '' };
}

async function existing(study: string): Promise<Set<string>> {
  try {
    const res = await fetch(`/dicomweb/studies/${study}/instances`, {
      headers: { authorization: `Bearer ${await token()}`, accept: 'application/dicom+json' },
    });
    if (res.status !== 200) return new Set();
    const rows = (await res.json()) as Record<string, { Value?: string[] } | undefined>[];
    return new Set(rows.map((r) => r['00080018']?.Value?.[0] ?? ''));
  } catch {
    return new Set();
  }
}

async function stowOne(item: Item): Promise<boolean> {
  const boundary = `s4-${crypto.getRandomValues(new Uint32Array(2)).join('')}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`,
    item.file,
    `\r\n--${boundary}--\r\n`,
  ]);
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    stats.sentBytes += item.size;
    try {
      const res = await fetch('/dicomweb/studies', {
        method: 'POST',
        body,
        headers: {
          authorization: `Bearer ${await token()}`,
          accept: 'application/dicom+json',
          'content-type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
        },
      });
      await res.arrayBuffer();
      if (res.status === 200) {
        stats.ackedBytes += item.size;
        await report();
        return true;
      }
    } catch {
      // the link dropped the request
    }
    interrupted(item.path);
    await report();
    await backoff(attempt);
  }
  return false;
}

export async function uploadStow(items: Item[]): Promise<boolean> {
  if (items.length === 0) return true;
  const first = items[0];
  const study = first ? (await uids(first.file)).study : '';
  const present = await existing(study);
  const queue: Item[] = [];
  for (const item of items) {
    if (present.has((await uids(item.file)).sop)) stats.resumedBytes += item.size;
    else queue.push(item);
  }
  let ok = true;
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      if (!(await stowOne(item))) ok = false;
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return ok;
}
