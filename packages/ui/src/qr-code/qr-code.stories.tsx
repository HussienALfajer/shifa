// QrCode stories, as on the approved sheet (owner, 2026-11-24, `QrCodeSheet`, ADR-0046). Every
// story renders in the eight combinations of direction × theme × density and is checked by axe.
// The URI is synthetic: a made-up key and a generator phone.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { QrCode } from './qr-code.tsx';

const URI =
  'otpauth://totp/Shifa:%2B963930012345?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Shifa&algorithm=SHA1&digits=6&period=30';
const LABEL = 'رمز QR لإضافة حساب شفاء إلى تطبيق المصادقة';

const meta = {
  title: 'Components/QrCode',
  component: QrCode,
  parameters: {
    docs: {
      description: {
        component:
          'The TOTP enrolment’s `otpauth://` URI drawn as a code a camera reads, encoded in the page (error correction M, a quiet zone of four modules) and never sent to a service, since the URI carries the secret key. The plate stays white and the modules ink in both themes (`color.scan.*`), and the code is never mirrored in RTL. Without `value` it shows a spinner in the code’s place at the same size; an error is the page’s Callout, never an empty code. On phones the screen folds it behind «عرض رمز QR لمسحه من جهاز آخر» and leads with the `otpauth://` link; the manual key beside it is the way to copy.\n\n**Accessibility.** One `role="img"` named by `label`; the URI is never text on the page. While loading, a `role="status"` with the same name. It has no keyboard interaction and takes no focus.',
      },
    },
  },
  args: { value: URI, label: LABEL },
} satisfies Meta<typeof QrCode>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sheet's rows: ready (desktop and tablet) and loading (before enrol/start answers). */
export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <QrCode value={URI} label={LABEL} />
      <QrCode label={LABEL} />
    </div>
  ),
};

const states = storyStates((label) => (
  <div className="flex flex-col items-start gap-3">
    <QrCode value={URI} label={label} />
    <p className="m-0 text-data leading-body text-text-muted">{label}</p>
  </div>
));
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
