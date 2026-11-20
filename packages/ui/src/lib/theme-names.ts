// The names of the token theme (packages/tokens/generated/css/tailwind-theme.css) that `cn()`
// must tell apart: `text-body` is a size and `text-text-muted` a colour, `shadow-card` a shadow.
// test/theme-names.test.ts checks this list against the generated theme.
export const THEME_NAMES = {
  spacing: ['0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '16'],
  radius: [
    'none',
    'xs',
    'sm',
    'md',
    'lg',
    'full',
    'mark',
    'input',
    'control',
    'surface',
    'overlay',
    'pill',
  ],
  shadow: ['card', 'dropdown', 'raised', 'overlay', 'modal', 'focus'],
  font: ['sans', 'serif', 'mono', 'ui', 'reading', 'code'],
  text: [
    '100',
    '200',
    '250',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    'caption',
    'data',
    'body',
    'body-lg',
    'heading-sm',
    'heading-md',
    'heading-lg',
    'display',
  ],
  'font-weight': ['regular', 'medium', 'semibold', 'bold', 'body', 'label', 'heading', 'display'],
  leading: ['tight', 'normal', 'relaxed', 'body', 'heading', 'reading'],
  ease: ['standard', 'enter', 'exit'],
} as const;

export type ThemeNamespace = keyof typeof THEME_NAMES;
