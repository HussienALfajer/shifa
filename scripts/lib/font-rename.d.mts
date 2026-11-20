/** A name record of a font's `name` table. */
export interface NameRecord {
  platformID: number;
  encodingID: number;
  languageID: number;
  nameID: number;
  text: string;
}

/** Reads the records of a `name` table. */
export function readNameRecords(table: Buffer): NameRecord[];

/**
 * The TrueType `font` with its family renamed (OD-59); throws when a kept record other than the
 * copyright notice still matches `reserved`.
 */
export function renameFamily(
  font: Buffer,
  options: { replace: Record<string, string>; reserved: RegExp },
): Buffer;
