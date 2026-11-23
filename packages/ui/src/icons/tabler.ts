// The curated Tabler icons by our name (MIT, outline, OD-65). Kept apart from icon.tsx so plain
// Node scripts (the design-system producer) can read it without Vite. "forward" and "back"
// follow the reading direction; the names predate Tabler (slice 0.4-03) and stay, so no caller
// changes when the drawing does.
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBell,
  IconCalendar,
  IconCalendarPlus,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconClock,
  IconCloudCheck,
  IconDental,
  IconDots,
  IconDroplet,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconHeartbeat,
  IconHome,
  IconInfoCircle,
  IconLogout,
  IconMenu2,
  IconMinus,
  IconPencil,
  IconPhone,
  IconPill,
  IconPlus,
  IconPrinter,
  IconSearch,
  IconSettings,
  IconStethoscope,
  IconTrash,
  IconUser,
  IconUsers,
  IconVaccine,
  IconWifiOff,
  IconX,
  type TablerIcon,
} from '@tabler/icons-react';

export type { TablerIcon };

/** Medical glyphs, by the names callers already use (Tabler has all six, so no Healthicons). */
export const HEALTH_GLYPHS = {
  'blood-drop': IconDroplet,
  'heart-organ': IconHeartbeat,
  medicines: IconPill,
  stethoscope: IconStethoscope,
  syringe: IconVaccine,
  tooth: IconDental,
} satisfies Record<string, TablerIcon>;

/** Interface glyphs. Carets are drawn as chevrons, the shape Phosphor's carets had. */
export const UI_GLYPHS = {
  'arrow-back': IconArrowLeft,
  'arrow-forward': IconArrowRight,
  bell: IconBell,
  calendar: IconCalendar,
  'calendar-plus': IconCalendarPlus,
  'caret-back': IconChevronLeft,
  'caret-down': IconChevronDown,
  'caret-forward': IconChevronRight,
  'caret-up': IconChevronUp,
  check: IconCheck,
  'check-circle': IconCircleCheck,
  clock: IconClock,
  'cloud-check': IconCloudCheck,
  dots: IconDots,
  eye: IconEye,
  'eye-slash': IconEyeOff,
  'file-text': IconFileText,
  gear: IconSettings,
  house: IconHome,
  info: IconInfoCircle,
  list: IconMenu2,
  'magnifying-glass': IconSearch,
  minus: IconMinus,
  pencil: IconPencil,
  phone: IconPhone,
  plus: IconPlus,
  printer: IconPrinter,
  'sign-out': IconLogout,
  trash: IconTrash,
  user: IconUser,
  users: IconUsers,
  warning: IconAlertTriangle,
  'wifi-slash': IconWifiOff,
  x: IconX,
  'x-circle': IconCircleX,
} satisfies Record<string, TablerIcon>;

/** Every curated glyph by name. */
export const GLYPHS = { ...UI_GLYPHS, ...HEALTH_GLYPHS };

export type GlyphName = keyof typeof GLYPHS;
