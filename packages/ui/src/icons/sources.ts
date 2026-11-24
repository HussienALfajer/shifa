// Where each curated icon comes from (OD-65, slice 0.4-09): Solar's Broken style (480 Design,
// CC BY 4.0), vendored as files in ./solar by scripts/icons-sync.ts from @iconify-json/solar,
// and the Healthicons tooth (CC0) in ./health, since Solar has none. The sync also writes
// ./generated/icons.ts (the SVG of each name, which Icon draws) and the Flutter painters;
// never edit them. Solar's licence is recorded in packages/ui/dependency-licences.json. Plain data, so Node scripts
// (the sync, the design-system producer) read it without Vite. The names predate Solar
// (slice 0.4-03) and stay, so no caller changes when the drawing does.

/** A vendored Solar glyph: its Solar name without the "-broken" suffix. */
export interface SolarSource {
  solar: string;
  /** Flip it horizontally when vendored: Solar draws it pointing to the start, we to the end. */
  mirror?: true;
}

/** Interface glyphs. Control glyphs (check, x, plus, minus) stay plain, not circled. */
export const SOLAR_UI = {
  // A-01-08: archiving a branch.
  archive: { solar: 'archive' },
  'arrow-back': { solar: 'arrow-left' },
  'arrow-forward': { solar: 'arrow-right' },
  bell: { solar: 'bell' },
  // A-01-08: branches (the switcher's branch rows, the branches page).
  buildings: { solar: 'buildings' },
  calendar: { solar: 'calendar' },
  'calendar-plus': { solar: 'calendar-add' },
  'caret-back': { solar: 'alt-arrow-left' },
  'caret-down': { solar: 'alt-arrow-down' },
  'caret-forward': { solar: 'alt-arrow-right' },
  'caret-up': { solar: 'alt-arrow-up' },
  check: { solar: 'check' },
  'check-circle': { solar: 'check-circle' },
  clock: { solar: 'clock-circle' },
  'cloud-check': { solar: 'cloud-check' },
  // A-01-10: copy and share of a value shown once (CopyField).
  copy: { solar: 'copy' },
  dots: { solar: 'menu-dots' },
  eye: { solar: 'eye' },
  'eye-slash': { solar: 'eye-closed' },
  'file-text': { solar: 'document-text' },
  gear: { solar: 'settings' },
  house: { solar: 'home' },
  info: { solar: 'info-circle' },
  list: { solar: 'hamburger-menu' },
  'magnifying-glass': { solar: 'magnifier' },
  minus: { solar: 'minus' },
  pencil: { solar: 'pen-2' },
  phone: { solar: 'phone' },
  plus: { solar: 'add' },
  printer: { solar: 'printer-minimalistic' },
  share: { solar: 'share' },
  'sign-out': { solar: 'logout-2', mirror: true },
  trash: { solar: 'trash-bin-minimalistic' },
  user: { solar: 'user-rounded' },
  users: { solar: 'users-group-rounded' },
  warning: { solar: 'danger-triangle' },
  // The owner's sheet showed "offline" as a cloud with a cross.
  'wifi-slash': { solar: 'cloud-cross' },
  x: { solar: 'close' },
  'x-circle': { solar: 'close-circle' },
} as const satisfies Record<string, SolarSource>;

/** Medical glyphs drawn by Solar. */
export const SOLAR_HEALTH = {
  'blood-drop': { solar: 'waterdrop' },
  'heart-organ': { solar: 'heart-pulse' },
  medicines: { solar: 'pill' },
  stethoscope: { solar: 'stethoscope' },
  syringe: { solar: 'syringe' },
} as const satisfies Record<string, SolarSource>;

/** Every vendored Solar glyph by our name. */
export const SOLAR: Record<keyof typeof SOLAR_UI | keyof typeof SOLAR_HEALTH, SolarSource> = {
  ...SOLAR_UI,
  ...SOLAR_HEALTH,
};

/** Medical glyphs kept as Healthicons files (CC0) in ./health. */
export const HEALTHICONS = ['tooth'] as const;

export type IconName = keyof typeof SOLAR | (typeof HEALTHICONS)[number];

/** The medical group of the list, whichever set draws it. */
export const HEALTH_NAMES: readonly IconName[] = [
  ...(Object.keys(SOLAR_HEALTH) as IconName[]),
  ...HEALTHICONS,
];

/**
 * The glyphs of the Flutter base widgets (ShifaGlyphs), by their Dart name, generated into
 * shifa_ui/lib/src/generated/glyphs.g.dart from the same Solar files.
 */
export const FLUTTER_GLYPHS = {
  check: 'check',
  close: 'close',
  chevronForward: 'alt-arrow-right',
  arrowBack: 'arrow-left',
  calendar: 'calendar',
  bell: 'bell',
  more: 'menu-dots-vertical',
  error: 'danger-circle',
  success: 'check-circle',
} as const satisfies Record<string, string>;
