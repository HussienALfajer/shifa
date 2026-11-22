// Card stories, as on the approved sheet (owner, 2026-11-22). Every story renders in the eight
// combinations of direction × theme × density and is checked by axe. Names are synthetic.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { storyStates } from '../../.storybook/story-states.tsx';
import { people } from '../../test/fixtures.ts';
import { Badge } from '../badge/badge.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../icon-button/icon-button.tsx';
import { Card, CardBody, CardFooter, CardHeader, CardLink } from './card.tsx';

const [patient, doctor, other] = people(3, { seed: 11 });

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component:
          'A white surface on cream: an optional header (title, description, actions at the logical end), a body and a footer. Not a control by itself. A link card puts one CardLink in its title: a press anywhere on the card follows it and its focus ring is drawn on the card; buttons inside stay their own controls.',
      },
    },
  },
  args: { children: null },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

function Appointment({ title = 'موعد اليوم' }: { title?: string }) {
  return (
    <Card className="w-(--shifa-size-popover)">
      <CardHeader
        title={title}
        description="الأحد 22/11/2026 · 10:30"
        actions={<IconButton size="sm" variant="ghost" icon="dots" label="خيارات الموعد" />}
      />
      <CardBody>
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">المريض</span>
          <span>{patient?.name}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-text-muted">الطبيب</span>
          <span>د. {doctor?.name}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-muted">الحالة</span>
          <Badge tone="queue-waiting">بالانتظار</Badge>
        </div>
      </CardBody>
      <CardFooter>
        <Button variant="primary" size="sm">
          سجّل الوصول
        </Button>
        <Button size="sm">تأجيل</Button>
      </CardFooter>
    </Card>
  );
}

/** Header, body and footer. */
export const Default: Story = { render: () => <Appointment /> };

/** Link cards: the whole card opens the record. */
export const LinkCard: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Card className="w-(--shifa-size-popover)">
        <CardHeader
          title={<CardLink href="#patient">{other?.name}</CardLink>}
          description="ملف رقم P-10482 · آخر زيارة 03/11/2026"
        />
        <CardBody>رصيد مستحق 45,000 ل.س</CardBody>
      </Card>
      <Card className="w-(--shifa-size-popover)">
        <CardHeader
          title={<CardLink href="#patient">{patient?.name}</CardLink>}
          description="ملف رقم P-10517"
        />
        <CardBody>
          <Badge tone="success">مسدّد</Badge>
        </CardBody>
      </Card>
    </div>
  ),
};

/** A figure card: body only. */
export const Stat: Story = {
  render: () => (
    <Card className="w-(--shifa-size-tooltip)">
      <CardBody className="gap-1">
        <span className="text-data font-medium text-text-muted">مرضى اليوم</span>
        <span className="text-heading-lg leading-heading font-semibold tabular-nums">18</span>
        <span className="text-data text-text-muted">5 بالانتظار · 12 انتهت</span>
      </CardBody>
    </Card>
  ),
};

const states = storyStates((label) => <Appointment title={label} />);
export const LongArabicLabel: Story = states['LongArabicLabel'] ?? {};
export const MixedDirection: Story = states['MixedDirection'] ?? {};
export const Zoom200: Story = states['Zoom200'] ?? {};
export const ReducedMotion: Story = states['ReducedMotion'] ?? {};
