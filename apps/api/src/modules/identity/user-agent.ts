// Device and browser names for «جلساتي» (A-01a criterion 10), from the User-Agent Better Auth
// stored with the session. Coarse on purpose: the raw string is never sent back to clients.

export interface DeviceBrowser {
  device: string | null;
  browser: string | null;
}

const DEVICES: readonly [RegExp, string][] = [
  [/iPad/, 'iPad'],
  [/iPhone|iPod/, 'iPhone'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Macintosh|Mac OS X/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

// Order matters: Edge, Opera and Samsung Internet also name Chrome and Safari.
const BROWSERS: readonly [RegExp, string][] = [
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Edg(A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const first = (rules: readonly [RegExp, string][], text: string) =>
  rules.find(([pattern]) => pattern.test(text))?.[1] ?? null;

export function describeUserAgent(userAgent: string | null | undefined): DeviceBrowser {
  const text = (userAgent ?? '').slice(0, 512);
  return { device: first(DEVICES, text), browser: first(BROWSERS, text) };
}
