// Finds the pinned Flutter SDK. Order: SHIFA_FLUTTER_ROOT (CI installs the version in .fvmrc
// there), then the FVM link .fvm/flutter_sdk. A global Flutter on PATH is never used, so every
// machine runs the version pinned in .fvmrc (ADR-0002, ADR-0012).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SETUP =
  'Flutter SDK not found. Install FVM once (`dart pub global activate fvm 4.3.2`), then run ' +
  '`fvm install` in the repository root (it reads .fvmrc and links .fvm/flutter_sdk).';

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   root: string,
 *   exists?: (path: string) => boolean,
 *   expected?: string | null,
 *   readVersion?: (sdkRoot: string) => string | null,
 * }} options `expected` is the version pinned in .fvmrc; when given, an SDK of another version
 *   is refused (a stale FVM link after a version bump or branch switch).
 * @returns {string} absolute path of the Flutter SDK root
 */
export function resolveFlutterRoot({
  env = process.env,
  root,
  exists = existsSync,
  expected = null,
  readVersion = readSdkVersion,
}) {
  const override = env.SHIFA_FLUTTER_ROOT;
  let sdk;
  if (override) {
    if (!exists(join(override, 'bin'))) {
      throw new Error(`SHIFA_FLUTTER_ROOT=${override} has no bin/ folder; is it a Flutter SDK?`);
    }
    sdk = override;
  } else {
    const fvmSdk = join(root, '.fvm', 'flutter_sdk');
    if (!exists(join(fvmSdk, 'bin'))) throw new Error(SETUP);
    sdk = fvmSdk;
  }
  if (expected) {
    const actual = readVersion(sdk);
    if (actual !== expected) {
      throw new Error(
        `Flutter ${actual ?? '(unknown version)'} at ${sdk}, but .fvmrc pins ${expected}. ` +
          'Run `fvm install` and `fvm use` in the repository root.',
      );
    }
  }
  return sdk;
}

/** Keys allowed in .fvmrc. FVM also honours flutterUrl and cache paths there, which could point
 * `fvm install` at another repository, so any other key is refused. CI checks the same list. */
const FVMRC_KEYS = new Set(['flutter', 'updateGitIgnore', 'updateVscodeSettings']);

/** @param {string} root repository root @returns {string | null} */
export function readPinnedVersion(root) {
  let config;
  try {
    config = JSON.parse(readFileSync(join(root, '.fvmrc'), 'utf8'));
  } catch {
    return null;
  }
  const unknown = Object.keys(config).filter((k) => !FVMRC_KEYS.has(k));
  if (unknown.length) throw new Error(`.fvmrc has unexpected keys: ${unknown.join(', ')}`);
  return config.flutter ?? null;
}

/** Version of an SDK: Flutter's own version file, else the `version` file at its root. */
export function readSdkVersion(sdkRoot) {
  try {
    const json = readFileSync(join(sdkRoot, 'bin', 'cache', 'flutter.version.json'), 'utf8');
    return JSON.parse(json).frameworkVersion ?? null;
  } catch {
    try {
      return readFileSync(join(sdkRoot, 'version'), 'utf8').trim() || null;
    } catch {
      return null;
    }
  }
}

/**
 * @param {string} sdkRoot
 * @param {'dart' | 'flutter'} tool
 * @param {NodeJS.Platform} platform
 */
export function toolPath(sdkRoot, tool, platform = process.platform) {
  if (tool !== 'dart' && tool !== 'flutter') {
    throw new Error(`unknown tool "${tool}": use dart or flutter`);
  }
  return join(sdkRoot, 'bin', platform === 'win32' ? `${tool}.bat` : tool);
}
