// Local images: the link shaper, the gateway and the dcmtk tools. Each is tagged by a hash of
// its inputs and built only when that tag is missing.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cacheDir, repoRoot } from '@shifa-spike/s4-generator';
import { docker } from './docker.ts';

const SPIKE = fileURLToPath(new URL('../../', import.meta.url));

async function hashTree(paths: string[]): Promise<string> {
  const hash = createHash('sha256');
  const walk = async (path: string): Promise<void> => {
    if ((await stat(path)).isDirectory()) {
      for (const entry of (await readdir(path)).sort()) {
        if (entry !== 'node_modules') await walk(join(path, entry));
      }
    } else {
      hash.update(relative(SPIKE, path).replaceAll('\\', '/'));
      hash.update(await readFile(path));
    }
  };
  for (const path of paths) await walk(path);
  return hash.digest('hex').slice(0, 16);
}

async function buildIfMissing(tag: string, context: string, dockerfile?: string): Promise<string> {
  const present = await docker(['image', 'inspect', tag], { check: false });
  if (present.code !== 0) {
    const args = ['build', '-t', tag, '--label', 'shifa.s4.image=1'];
    if (dockerfile) args.push('-f', dockerfile);
    await docker([...args, context], { timeoutMs: 900_000 });
  }
  return tag;
}

export async function linkImage(): Promise<string> {
  const dir = join(SPIKE, 'link');
  return buildIfMissing(`shifa-s4-link:${await hashTree([dir])}`, dir);
}

/**
 * Copies a package and its production dependency closure into `dest/node_modules`, flattened
 * like npm (nested only on a version clash). pnpm's links do not survive a Docker build
 * context on Windows; plain directories do.
 */
async function vendor(packageDir: string, dest: string): Promise<void> {
  const top = join(dest, 'node_modules');
  const placed = new Map<string, string>(); // name → real dir at top level
  const queue: { from: string; into: string }[] = [{ from: packageDir, into: top }];
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    const manifest = JSON.parse(await readFile(join(item.from, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies });
    // A package's dependencies are its siblings in pnpm's store (or its own node_modules).
    const scoped = item.from.split(/[\\/]/).at(-2)?.startsWith('@') ?? false;
    const siblings = scoped ? dirname(dirname(item.from)) : dirname(item.from);
    for (const name of names) {
      const candidates = [join(item.from, 'node_modules', name), join(siblings, name)];
      const found = candidates.find((c) => existsSync(c));
      if (!found) continue; // an optional dependency not installed for this platform
      const real = await realpath(found);
      const atTop = placed.get(name);
      if (atTop === real) continue;
      const target = atTop === undefined ? join(top, name) : join(item.into, 'node_modules', name);
      if (atTop === undefined) placed.set(name, real);
      if (existsSync(target)) continue;
      await cp(real, target, {
        recursive: true,
        dereference: true,
        filter: (s) => !s.includes(`${real}/node_modules`) && !s.includes(`${real}\\node_modules`),
      });
      queue.push({ from: real, into: target });
    }
  }
}

export async function gatewayImage(): Promise<string> {
  const gateway = join(SPIKE, 'gateway');
  const inputs = [
    join(gateway, 'src'),
    join(gateway, 'package.json'),
    join(gateway, 'Dockerfile'),
    join(repoRoot(), 'pnpm-lock.yaml'),
  ];
  const tag = `shifa-s4-gateway:${await hashTree(inputs)}`;
  if ((await docker(['image', 'inspect', tag], { check: false })).code === 0) return tag;
  const context = cacheDir('build', 'gateway');
  await rm(context, { recursive: true, force: true });
  await mkdir(context, { recursive: true });
  await cp(join(gateway, 'src'), join(context, 'src'), { recursive: true });
  await cp(join(gateway, 'package.json'), join(context, 'package.json'));
  await cp(join(gateway, 'Dockerfile'), join(context, 'Dockerfile'));
  await vendor(gateway, context);
  return buildIfMissing(tag, context);
}
