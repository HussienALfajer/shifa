// The shifa_ui CI goldens on Linux, in Docker (slice 0.4-08). Text is drawn as blocks, but edge
// smoothing still differs a little between Linux, Windows and macOS, so the committed goldens are
// the Linux ones: CI (Linux) and WSL2 compare them in `flutter test`; other hosts skip them there
// and use this script.
//   node packages/shifa_ui/scripts/goldens.mjs            compare (as CI does)
//   node packages/shifa_ui/scripts/goldens.mjs --update   rewrite test/goldens/ci (look at each)
// The image is scripts/goldens.Dockerfile. The Flutter SDK of .fvmrc is downloaded once into the
// Docker volume `shifa-flutter-<version>` and checked against FLUTTER_SHA256 of ci.yml. The
// container works on a copy of the pub workspace; only test/goldens/ci is written back.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const args = process.argv.slice(2);
const update = args.includes('--update');
if (args.some((a) => a !== '--update')) {
  process.stderr.write(`goldens: unknown argument (use --update or none): ${args.join(' ')}\n`);
  process.exit(2);
}

const version = JSON.parse(readFileSync(join(root, '.fvmrc'), 'utf8')).flutter;
const sha = /^\s*FLUTTER_SHA256:\s*([0-9a-f]{64})\s*$/m.exec(
  readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8'),
)?.[1];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || !sha) {
  process.stderr.write(
    'goldens: cannot read the Flutter version (.fvmrc) or FLUTTER_SHA256 (ci.yml)\n',
  );
  process.exit(2);
}

const image = `shifa-flutter-goldens:${version}`;
const run = (cmd, cmdArgs) => spawnSync(cmd, cmdArgs, { stdio: 'inherit' }).status ?? 1;

if (
  run('docker', [
    'build',
    '-q',
    '-t',
    image,
    '-f',
    join(import.meta.dirname, 'goldens.Dockerfile'),
    import.meta.dirname,
  ]) !== 0
) {
  process.stderr.write('goldens: docker build failed (is Docker running?)\n');
  process.exit(1);
}

// Runs inside the container: version and hash are checked above and passed as variables.
const inside = String.raw`
set -eu
sdk=/opt/flutter-sdk
if [ ! -x "$sdk/flutter/bin/flutter" ]; then
  archive="flutter_linux_$V-stable.tar.xz"
  curl -fsSL -o "/tmp/$archive" "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/$archive"
  echo "$SHA  /tmp/$archive" | sha256sum --check --strict
  tar -xJf "/tmp/$archive" -C "$sdk"
  rm "/tmp/$archive"
fi
git config --global --add safe.directory "$sdk/flutter"
export PATH="$sdk/flutter/bin:$PATH" PUB_CACHE="$sdk/pub-cache"
flutter --disable-analytics > /dev/null
mkdir -p /work
cd /src
tar --exclude=.dart_tool --exclude=build --exclude=node_modules --exclude='test/goldens/failures' \
  -cf - pubspec.yaml pubspec.lock analysis_options.yaml \
  packages/shifa_ui packages/api_client_dart packages/shifa_testing | tar -xf - -C /work
cd /work
flutter pub get --enforce-lockfile > /dev/null
cd packages/shifa_ui
status=0
flutter test --tags golden $UPDATE || status=$?
if [ -n "$UPDATE" ]; then cp test/goldens/ci/*.png /out/; fi
if [ -d test/goldens/failures ]; then mkdir -p /failures && cp -r test/goldens/failures/. /failures/; fi
exit $status
`;

const ci = join(root, 'packages', 'shifa_ui', 'test', 'goldens', 'ci');
const failures = join(root, 'packages', 'shifa_ui', 'test', 'goldens', 'failures');
const status = run('docker', [
  'run',
  '--rm',
  '-e',
  `V=${version}`,
  '-e',
  `SHA=${sha}`,
  '-e',
  `UPDATE=${update ? '--update-goldens' : ''}`,
  '-v',
  `shifa-flutter-${version}:/opt/flutter-sdk`,
  '-v',
  `${root}:/src:ro`,
  '-v',
  `${ci}:/out`,
  '-v',
  `${failures}:/failures`,
  image,
  'bash',
  '-c',
  inside,
]);
if (status !== 0) {
  process.stderr.write(`goldens: failed; difference images (if any) are in ${failures}\n`);
}
process.exit(status);
