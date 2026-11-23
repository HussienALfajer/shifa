// The curated icon list: Tabler Icons outline, medical glyphs included (OD-65). Directional icons mirror in
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
          'Tabler Icons (MIT), outline in one tone, the stroke in the text colour; 20 px in rows and controls, 24 px in navigation and cards; medical glyphs from Tabler too. Decorative unless given a `label`. Only arrows, carets and sign-out mirror in RTL.',
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
