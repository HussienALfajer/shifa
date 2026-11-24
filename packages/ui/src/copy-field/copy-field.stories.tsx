// CopyField stories, as on the approved sheet (owner, 2026-11-24, `CopyFieldSheet`, ADR-0046).
// Every story renders in the eight combinations of direction × theme × density and is checked by
// axe. The link is made up.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { storyStates } from '../../.storybook/story-states.tsx';
import { CopyField } from './copy-field.tsx';

const URL = 'https://clinic.shifa.example/setup#t=Qm9ndXMtc3ludGhldGljLXRva2VuLTAwMDE';
const SHARE = { href: `https://wa.me/?text=${encodeURIComponent(URL)}`, label: 'إرسال عبر واتساب' };

const meta = {
  title: 'Components/CopyField',
  component: CopyField,
  parameters: {
    docs: {
      description: {
        component:
          'A value shown once to copy or send: the owner’s setup link on admin web, a member’s link. Read-only, left to right in the mono font in both directions, with «نسخ» inside the box at the logical end, and optionally «إرسال عبر واتساب» and an expiry line under it. Focus selects the whole value. After a copy the button reads «نُسخ» with a tick for three seconds; a refused clipboard selects the value and asks to copy it by hand. `multiline` wraps a long value (a phone), `iconOnly` keeps the copy to its icon, `disabled` mutes a replaced link with nothing to copy or share, and no value is the loading state. The value is never stored or sent by the component.\n\n**Accessibility.** A read-only text box named by `label` (its visible label), described by the expiry line, isolated left to right inside the Arabic page and never translated. Tab reaches the value, then the copy button (named «نسخ» even when it shows its icon only), then the share link (opens a new tab). A copy is announced once through a status; the refusal is a visible line.',
      },
    },
  },
  args: { value: URL, label: 'رابط الإعداد' },
} satisfies Meta<typeof CopyField>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Copy, WhatsApp and the expiry, as on admin web. */
export const Default: Story = {
  args: { share: SHARE, expiry: 'ينتهي بعد 72 ساعة · يعمل مرة واحدة' },
};

/** Focus selects the whole value. */
export const Focused: Story = {
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getAllByRole('textbox')[0];
    if (box) await userEvent.click(box);
    await expect(box).toHaveFocus();
  },
};

/** A long value over several lines, the copy as its icon: a phone. */
export const MultilinePhone: Story = { args: { multiline: true, iconOnly: true, share: SHARE } };

/** A replaced link: muted, nothing to copy or share. */
export const Disabled: Story = {
  args: { disabled: true, share: SHARE, expiry: 'استُبدل هذا الرابط برابط أحدث.' },
};

/** Waiting for the value. */
export const Loading: Story = { args: { value: undefined } };

/** An English page. */
export const English: Story = {
  args: {
    label: 'Setup link',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    expiry: 'Expires in 72 hours',
  },
};

const states = storyStates((label) => <CopyField value={URL} label={label} expiry={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
