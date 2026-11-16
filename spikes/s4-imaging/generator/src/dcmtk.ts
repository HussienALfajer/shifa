// dcmtk in a container (dcmtk.Dockerfile, pinned base): dcmmkdir writes the DICOMDIR of the
// with-dicomdir study. The image is tagged by a hash of its Dockerfile and built once.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cacheDir } from './paths.ts';

const DOCKERFILE = fileURLToPath(new URL('../dcmtk.Dockerfile', import.meta.url));

function run(args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? -1, stderr });
    });
  });
}

export async function dcmtkImage(): Promise<string> {
  const hash = createHash('sha256')
    .update(await readFile(DOCKERFILE))
    .digest('hex')
    .slice(0, 16);
  const tag = `shifa-s4-dcmtk:${hash}`;
  if ((await run(['image', 'inspect', tag])).code !== 0) {
    const context = cacheDir('build', 'dcmtk');
    await mkdir(context, { recursive: true });
    const built = await run(['build', '-t', tag, '-f', DOCKERFILE, context]);
    if (built.code !== 0) throw new Error(`dcmtk image build failed: ${built.stderr.slice(-400)}`);
  }
  return tag;
}

/** Runs a dcmtk command with `dir` mounted at /data (the working directory). */
export async function dcmtk(dir: string, command: string[]): Promise<void> {
  const image = await dcmtkImage();
  const result = await run([
    'run',
    '--rm',
    '--network',
    'none',
    '--mount',
    `type=bind,source=${dir},target=/data`,
    image,
    ...command,
  ]);
  if (result.code !== 0)
    throw new Error(`${command[0] ?? 'dcmtk'} failed: ${result.stderr.slice(-400)}`);
}
