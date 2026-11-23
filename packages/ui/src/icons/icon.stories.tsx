// The curated icon list: Solar Broken (480 Design, CC BY 4.0) and the Healthicons tooth (OD-65). Directional icons mirror in
// RTL (compare the RTL and LTR cells of the matrix).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DIRECTIONAL_ICONS, HEALTH_ICONS, ICON_NAMES, Icon } from './icon.tsx';

const meta = {
  title: 'Foundations/Icon',
  component: Icon,
  args: { name: 'calendar-plus' },
  argTypes: {
    name: { control: 'select', options: ICON_NAMES },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Solar icons by 480 Design (CC BY 4.0), Broken style: one tone, the stroke in the text colour; 20 px in rows and controls, 24 px in navigation and cards; the tooth is Healthicons (CC0). Only arrows, carets and sign-out mirror in RTL.\n\n**Accessibility.** An inline `svg` that is never focusable: no keyboard interaction. Without a `label` it is decorative and hidden from screen readers (`aria-hidden="true"`); with one it is `role="img"` with that `aria-label`. Give a `label` only when the icon carries meaning no nearby text gives; an icon-only button is named on the button (`aria-label`), not on the icon.',
      },
    },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const All: Story = {
  render: () => (
    <ul className="m-0 grid list-none grid-cols-4 gap-3 p-0 text-icon-default">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex items-center gap-2 text-200 text-text-muted">
          <Icon name={name} size="md" />
          <span dir="ltr">
            {name}
            {DIRECTIONAL_ICONS.includes(name) ? ' ↔' : ''}
            {(HEALTH_ICONS as readonly string[]).includes(name) ? ' (health)' : ''}
          </span>
        </li>
      ))}
    </ul>
  ),
};
