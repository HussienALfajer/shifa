// Poppler in a container (docker/pdf-tools.Dockerfile): text in logical order, fonts, page sizes
// and page rasters of a PDF. Every call uploads the PDF; no host install is needed.
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export interface PdfPage {
  widthPt: number;
  heightPt: number;
}

export interface PdfFont {
  name: string;
  type: string;
  embedded: boolean;
}

export interface PdfTools {
  version(): Promise<string>;
  /** Text (PDFium) of the whole file or one page (1-based); pages separated by form feeds. */
  text(pdf: Uint8Array, page?: number): Promise<string>;
  fonts(pdf: Uint8Array): Promise<PdfFont[]>;
  info(pdf: Uint8Array): Promise<PdfPage[]>;
  /** One PNG per page at `dpi` (default 150). */
  rasterise(pdf: Uint8Array, dpi?: number): Promise<Uint8Array[]>;
  stop(): Promise<void>;
}

const DOCKER_DIR = join(import.meta.dirname, '..', 'docker');

export async function startPdfTools(): Promise<PdfTools> {
  const image = await GenericContainer.fromDockerfile(DOCKER_DIR, 'pdf-tools.Dockerfile').build(
    'shifa-s3-pdf-tools:local',
    { deleteOnExit: false },
  );
  const container: StartedTestContainer = await image.start();

  async function sh(script: string): Promise<string> {
    const result = await container.exec(['sh', '-c', script]);
    if (result.exitCode !== 0)
      throw new Error(`pdf-tools: exit ${String(result.exitCode)}: ${result.stderr.slice(0, 300)}`);
    return result.stdout;
  }

  async function upload(pdf: Uint8Array): Promise<string> {
    const target = `/tmp/${randomUUID()}.pdf`;
    await container.copyContentToContainer([{ content: Buffer.from(pdf), target }]);
    return target;
  }

  async function info(pdf: Uint8Array): Promise<PdfPage[]> {
    const file = await upload(pdf);
    const out = await sh(`pdfinfo -f 1 -l 9999 ${file}`);
    const pages: PdfPage[] = [];
    for (const match of out.matchAll(/^Page\s+\d+ size:\s+([\d.]+) x ([\d.]+) pts/gm)) {
      pages.push({ widthPt: Number(match[1]), heightPt: Number(match[2]) });
    }
    return pages;
  }

  return {
    version: async () =>
      (await container.exec(['pdftotext', '-v'])).output.split('\n')[0]?.trim() ?? '',
    text: async (pdf, page) => {
      const file = await upload(pdf);
      // PDFium (Chrome's and Android's PDF engine), not pdftotext: pdftotext splits Arabic
      // words at glyph-positioning gaps and wraps runs in bidi controls of its own (report §3).
      const range = page === undefined ? '' : `${String(page)} ${String(page)}`;
      return sh(`/opt/pdfium/bin/python /usr/local/bin/pdfium-text.py ${file} ${range}`);
    },
    fonts: async (pdf) => {
      const file = await upload(pdf);
      const lines = (await sh(`pdffonts ${file}`))
        .split('\n')
        .slice(2)
        .filter((l) => l.trim() !== '');
      // Columns: name type encoding emb sub uni object ID; name and type have no spaces here
      // except the type ("CID TrueType"), so read emb/sub/uni from the right.
      return lines.map((line) => {
        const cols = line.trim().split(/\s+/);
        const [emb] = cols.slice(-5, -4);
        return { name: cols[0] ?? '', type: cols.slice(1, -6).join(' '), embedded: emb === 'yes' };
      });
    },
    info,
    rasterise: async (pdf, dpi = 150) => {
      const file = await upload(pdf);
      const count = (await info(pdf)).length;
      const pages: Uint8Array[] = [];
      for (let n = 1; n <= count; n += 1) {
        const b64 = await sh(
          `pdftoppm -r ${String(dpi)} -png -f ${String(n)} -l ${String(n)} ${file} | base64 -w0`,
        );
        pages.push(new Uint8Array(Buffer.from(b64, 'base64')));
      }
      return pages;
    },
    stop: async () => {
      await container.stop();
    },
  };
}
