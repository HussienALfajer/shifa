// multipart/related helpers for STOW-RS bodies and WADO-RS responses (tests and the bench).
import { randomBytes } from 'node:crypto';

/** A STOW-RS request body and its Content-Type for the given DICOM files. */
export function stowBody(files: readonly Uint8Array[]): { body: Buffer; contentType: string } {
  const boundary = `s4-${randomBytes(12).toString('hex')}`;
  const parts: Buffer[] = [];
  for (const file of files) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`));
    parts.push(Buffer.from(file));
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/related; type="application/dicom"; boundary=${boundary}`,
  };
}

/** The part bodies of a multipart/related response. */
export function multipartParts(body: Uint8Array, contentType: string): Buffer[] {
  const match = /boundary="?([^";]+)"?/i.exec(contentType);
  if (!match?.[1]) throw new Error('multipart response without a boundary');
  const data = Buffer.from(body);
  const delimiter = Buffer.from(`--${match[1]}`);
  const parts: Buffer[] = [];
  let start = data.indexOf(delimiter);
  while (start !== -1) {
    const afterDelimiter = start + delimiter.length;
    if (data.subarray(afterDelimiter, afterDelimiter + 2).toString() === '--') break;
    const headerEnd = data.indexOf('\r\n\r\n', afterDelimiter);
    const next = data.indexOf(delimiter, headerEnd);
    if (headerEnd === -1 || next === -1) break;
    // The part ends with CRLF before the next delimiter.
    parts.push(data.subarray(headerEnd + 4, next - 2));
    start = next;
  }
  return parts;
}
