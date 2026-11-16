// Fetches the pinned public CBCT case into .cache/s4/public-cbct/ (never committed).
// `--pin` re-reads the dataset ZIP, writes the case's files and rewrites public-cbct.lock.json
// (review the diff); a later run without it re-checks every file against the new pins.
import { fetchPublicCbct, pinPublicCbct } from '../src/public-cbct.ts';

const URL_ZIP =
  'https://download.scidb.cn/download?fileId=8e263f7b3391e011251970d5a86c8e2a&dataSetType=personal&fileName=Dataset_repaired.zip';
const CASE = 'Dataset/annotated/image/Newtom/N09/';
const ATTRIBUTION =
  "Lan Feng, Zhi Li, Qihang Gu, Yaqi Wang, Xiaoyang Yu. Adults' dental cone beam computed tomography images dataset for detecting and classifying missing teeth. V2. Science Data Bank, 2026. https://doi.org/10.57760/sciencedb.26465. Licensed CC BY 4.0. One case (NewTom N09) used unmodified as test data.";

if (process.argv.includes('--pin')) {
  const lock = await pinPublicCbct({
    url: URL_ZIP,
    casePrefix: CASE,
    attribution: ATTRIBUTION,
    zipBytes: 23_534_221_851,
  });
  const bytes = lock.files.reduce((sum, f) => sum + f.bytes, 0);
  process.stdout.write(`pinned ${String(lock.files.length)} files, ${String(bytes)} bytes\n`);
} else {
  const { dir } = await fetchPublicCbct();
  process.stdout.write(`public CBCT case in ${dir}\n`);
}
