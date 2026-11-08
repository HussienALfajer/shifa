// Finds the pinned Flutter SDK. Order: SHIFA_FLUTTER_ROOT (CI installs the version in .fvmrc
// there), then the FVM link .fvm/flutter_sdk. A global Flutter on PATH is never used, so every
// machine runs the version pinned in .fvmrc (ADR-0002, ADR-0012).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SETUP =
  'Flutter SDK not found. Install FVM once (`dart pub global activate fvm`), then run ' +
  '`fvm install` in the repository root (it reads .fvmrc and links .fvm/flutter_sdk).';

/**
 * @param {{ env?: NodeJS.ProcessEnv, root: string, exists?: (path: string) => boolean }} options
 * @returns {string} absolute path of the Flutter SDK root
 */
export function resolveFlutterRoot({ env = process.env, root, exists = existsSync }) {
  const override = env.SHIFA_FLUTTER_ROOT;
  if (override) {
    if (!exists(join(override, 'bin'))) {
      throw new Error(`SHIFA_FLUTTER_ROOT=${override} has no bin/ folder; is it a Flutter SDK?`);
    }
    return override;
  }
  const fvmSdk = join(root, '.fvm', 'flutter_sdk');
  if (exists(join(fvmSdk, 'bin'))) return fvmSdk;
  throw new Error(SETUP);
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
