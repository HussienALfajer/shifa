// Renames a font family inside a TrueType file (OD-59): the OFL of IBM Plex Sans Arabic reserves
// the name "Plex", and a subset is a Modified Version, so the web subsets carry another name.
// Only the `name` table changes: the family, full, unique and PostScript names are rewritten,
// the trademark notice (which names the reserved name) is dropped, and the copyright and licence
// notices are kept as they are. Checksums are recomputed so the result is a valid font.

/** Name IDs whose text holds the family name (OpenType `name` table). */
const FAMILY_NAME_IDS = new Set([1, 3, 4, 6, 16, 17, 18, 21, 22, 25]);
const TRADEMARK = 7;
const COPYRIGHT = 0;

const checksum = (bytes) => {
  const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
  bytes.copy(padded);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
};

/** Windows and Unicode strings are UTF-16BE; Mac Roman is kept byte for byte (ASCII edits only). */
const isUtf16 = (platformID) => platformID === 0 || platformID === 3;
const decode = (platformID, bytes) =>
  isUtf16(platformID) ? bytes.swap16().toString('utf16le') : bytes.toString('latin1');
const encode = (platformID, text) =>
  isUtf16(platformID) ? Buffer.from(text, 'utf16le').swap16() : Buffer.from(text, 'latin1');

/** Reads the records of a `name` table: [{ platformID, encodingID, languageID, nameID, text }]. */
export function readNameRecords(table) {
  const count = table.readUInt16BE(2);
  const storage = table.readUInt16BE(4);
  const records = [];
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 12;
    const [platformID, encodingID, languageID, nameID, length, offset] = [0, 2, 4, 6, 8, 10].map(
      (o) => table.readUInt16BE(at + o),
    );
    const bytes = Buffer.from(table.subarray(storage + offset, storage + offset + length));
    records.push({ platformID, encodingID, languageID, nameID, text: decode(platformID, bytes) });
  }
  return records;
}

/** A format 0 `name` table holding `records`, sorted as the specification requires. */
function writeNameTable(records) {
  const sorted = [...records].sort(
    (a, b) =>
      a.platformID - b.platformID ||
      a.encodingID - b.encodingID ||
      a.languageID - b.languageID ||
      a.nameID - b.nameID,
  );
  const strings = sorted.map((r) => encode(r.platformID, r.text));
  const header = Buffer.alloc(6 + sorted.length * 12);
  header.writeUInt16BE(0, 0);
  header.writeUInt16BE(sorted.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  sorted.forEach((r, i) => {
    const at = 6 + i * 12;
    const values = [r.platformID, r.encodingID, r.languageID, r.nameID, strings[i].length, offset];
    values.forEach((v, j) => header.writeUInt16BE(v, at + j * 2));
    offset += strings[i].length;
  });
  return Buffer.concat([header, ...strings]);
}

/** The tables of an sfnt file in file order: [{ tag, data }]. */
function readTables(font) {
  const count = font.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    const tag = font.toString('latin1', at, at + 4);
    const offset = font.readUInt32BE(at + 8);
    const length = font.readUInt32BE(at + 12);
    tables.push({ tag, offset, data: Buffer.from(font.subarray(offset, offset + length)) });
  }
  return tables.sort((a, b) => a.offset - b.offset);
}

/** An sfnt file from its tables, with table checksums and head.checkSumAdjustment computed. */
function writeFont(sfntVersion, tables) {
  const count = tables.length;
  const power = 2 ** Math.floor(Math.log2(count));
  const directory = Buffer.alloc(12 + count * 16);
  directory.writeUInt32BE(sfntVersion, 0);
  directory.writeUInt16BE(count, 4);
  directory.writeUInt16BE(power * 16, 6);
  directory.writeUInt16BE(Math.log2(power), 8);
  directory.writeUInt16BE(count * 16 - power * 16, 10);
  const head = tables.find((t) => t.tag === 'head');
  if (head) head.data.writeUInt32BE(0, 8);
  const byTag = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : 1));
  let offset = directory.length;
  const placed = new Map();
  for (const table of tables) {
    placed.set(table.tag, offset);
    offset += Math.ceil(table.data.length / 4) * 4;
  }
  byTag.forEach((table, i) => {
    const at = 12 + i * 16;
    directory.write(table.tag, at, 'latin1');
    directory.writeUInt32BE(checksum(table.data), at + 4);
    directory.writeUInt32BE(placed.get(table.tag), at + 8);
    directory.writeUInt32BE(table.data.length, at + 12);
  });
  const body = tables.map((t) => {
    const padded = Buffer.alloc(Math.ceil(t.data.length / 4) * 4);
    t.data.copy(padded);
    return padded;
  });
  const font = Buffer.concat([directory, ...body]);
  if (head) font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, placed.get('head') + 8);
  return font;
}

/**
 * A weight outside regular and bold names its family "<family> Medium" in name ID 1 and holds
 * the family itself in the typographic names (IDs 16 and 17), which a subset drops. A web font is
 * chosen by its @font-face rule, not by these names, so the typographic names move into IDs 1
 * and 2: every subset of the family then carries the one family name.
 */
function typographicNames(records) {
  const key = (r) => `${r.platformID}/${r.encodingID}/${r.languageID}`;
  const typographic = new Map(
    records
      .filter((r) => r.nameID === 16 || r.nameID === 17)
      .map((r) => [`${key(r)}/${r.nameID}`, r.text]),
  );
  return records
    .filter((r) => r.nameID !== 16 && r.nameID !== 17)
    .map((r) => {
      const moved =
        r.nameID === 1 || r.nameID === 2
          ? typographic.get(`${key(r)}/${r.nameID + 15}`)
          : undefined;
      return moved === undefined ? r : { ...r, text: moved };
    });
}

/**
 * The TrueType `font` with its family renamed. `replace` maps each spelling of the old name to
 * the new one (`{ 'IBM Plex Sans Arabic': 'Shifa Sans Arabic', IBMPlexSansArabic: 'ShifaSansArabic' }`).
 * Throws when a kept record other than the copyright notice still matches `reserved`.
 * @param {Buffer} font
 * @param {{ replace: Record<string, string>, reserved: RegExp }} options
 */
export function renameFamily(font, { replace, reserved }) {
  const tables = readTables(font);
  const name = tables.find((t) => t.tag === 'name');
  if (!name) throw new Error('font-rename: the font has no name table');
  const renamed = readNameRecords(name.data)
    .filter((r) => r.nameID !== TRADEMARK && r.languageID < 0x8000)
    .map((r) => {
      if (!FAMILY_NAME_IDS.has(r.nameID)) return r;
      let text = r.text;
      for (const [from, to] of Object.entries(replace)) text = text.replaceAll(from, to);
      return { ...r, text };
    });
  const records = typographicNames(renamed);
  const left = records.filter((r) => r.nameID !== COPYRIGHT && reserved.test(r.text));
  if (left.length > 0) {
    const ids = left.map((r) => r.nameID).join(', ');
    throw new Error(`font-rename: name IDs ${ids} still hold the reserved name`);
  }
  name.data = writeNameTable(records);
  return writeFont(font.readUInt32BE(0), tables);
}
