// multipart/related helpers for STOW-RS bodies and WADO-RS responses (tests and the bench).
import { createHash, randomBytes } from 'node:crypto';

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

/**
 * SHA-256 of a Part 10 file's dataset, after the preamble, marker and file meta group (0002).
 * A C-STORE hop rewrites the meta group (the receiver writes its own); the dataset arrives
 * byte for byte (owner decision, 0.3-S4b).
 */
export function datasetSha256(file: Uint8Array): string {
  const bytes = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  if (bytes.subarray(128, 132).toString('latin1') !== 'DICM') throw new Error('not Part 10');
  // (0002,0000) UL, explicit VR little endian: tag 4, VR 2, length 2, value 4.
  const groupLength = bytes.readUInt32LE(140);
  return createHash('sha256')
    .update(bytes.subarray(144 + groupLength))
    .digest('hex');
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
