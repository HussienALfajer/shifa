// Data table stories, as on the approved sheet (owner, 2026-11-22, OD-64): a synthetic patient list
// (sorted, two rows selected) and a synthetic invoice list of 5,000 rows, loading and empty. Every
// story renders in the eight combinations of direction × theme × density and is checked by axe.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import { nationalPhone, people, phones } from '../../test/fixtures.ts';
import { Badge, type BadgeTone } from '../badge/badge.tsx';
import { Pagination } from '../pagination/pagination.tsx';
import { DataTable, type DataTableColumn } from './data-table.tsx';

interface Patient {
  id: string;
  name: string;
  file: string;
  phone: string;
  visit: string;
  status: { tone: BadgeTone; label: string };
  balance: number;
}

const STATUS: Patient['status'][] = [
  { tone: 'queue-waiting', label: 'بالانتظار' },
  { tone: 'queue-in-room', label: 'في الغرفة' },
  { tone: 'queue-done', label: 'انتهت' },
  { tone: 'queue-no-show', label: 'لم يحضر' },
  { tone: 'queue-booked', label: 'محجوز' },
];

const PHONES = phones(8, { seed: 41 }).map(nationalPhone);

const PATIENTS: Patient[] = people(8, { seed: 41 }).map((p, i) => ({
  id: p.id,
  name: p.name,
  file: `P-${String(10400 + i * 37)}`,
  phone: PHONES[i] ?? '',
  visit: `${String(22 - i)}/11/2026`,
  status: STATUS[i % STATUS.length] ?? { tone: 'queue-done', label: 'انتهت' },
  balance: [0, 45000, 0, 120000, 0, 15500, 1250000, 0][i] ?? 0,
}));

const PATIENT_COLUMNS: DataTableColumn<Patient>[] = [
  { id: 'name', header: 'الاسم', value: (p) => p.name, sortable: true },
  { id: 'file', header: 'رقم الملف', value: (p) => p.file, kind: 'latin', width: 'sm' },
  { id: 'phone', header: 'الهاتف', value: (p) => p.phone, kind: 'latin' },
  { id: 'visit', header: 'آخر زيارة', value: (p) => p.visit, sortable: true, width: 'sm' },
  {
    id: 'status',
    header: 'الحالة',
    value: (p) => p.status.label,
    cell: (p) => <Badge tone={p.status.tone}>{p.status.label}</Badge>,
  },
  {
    id: 'balance',
    header: 'الرصيد (ل.س)',
    value: (p) => p.balance,
    kind: 'number',
    sortable: true,
  },
];

const NAMES = people(20, { seed: 53 }).map((p) => p.name);

interface Invoice {
  id: string;
  no: string;
  name: string;
  date: string;
  amount: number;
  paid: number;
}

const INVOICES: Invoice[] = Array.from({ length: 5000 }, (_, i) => {
  const amount = (((i * 7919) % 120) + 5) * 5000;
  return {
    id: String(i + 1),
    no: `INV-2026-${String(i + 1).padStart(4, '0')}`,
    name: NAMES[i % NAMES.length] ?? '',
    date: `${String((i % 28) + 1).padStart(2, '0')}/11/2026`,
    amount,
    paid: i % 3 === 0 ? amount : i % 3 === 1 ? amount / 2 : 0,
  };
});

const INVOICE_COLUMNS: DataTableColumn<Invoice>[] = [
  { id: 'no', header: 'رقم الفاتورة', value: (r) => r.no, kind: 'latin' },
  { id: 'name', header: 'المريض', value: (r) => r.name },
  { id: 'date', header: 'التاريخ', value: (r) => r.date, sortable: true, width: 'sm' },
  { id: 'amount', header: 'المبلغ', value: (r) => r.amount, kind: 'number', sortable: true },
  { id: 'paid', header: 'المدفوع', value: (r) => r.paid, kind: 'number' },
  { id: 'rest', header: 'المتبقي', value: (r) => r.amount - r.paid, kind: 'number' },
];

const meta = {
  title: 'Components/DataTable',
  component: DataTable,
  parameters: {
    docs: {
      description: {
        component:
          'A dense grid that stays fast with thousands of rows. One Tab stop on the active cell; the arrows follow the reading direction (Left is the next column in Arabic), Home/End, Ctrl+Home/End, PageUp/PageDown; Space selects, Enter opens the row (or sorts on a header, or enters a control in a cell; Escape comes back). Sorting, selection with select-all, column visibility (the columns menu under the table), sticky header and pinned first column, both densities, loading and empty states. Columns and rows in; no data fetching.',
      },
    },
  },
  args: { 'aria-label': 'قائمة المرضى', columns: [], rows: [], getRowId: () => '' },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The matrix draws each story eight times on one page: each copy gets its own names (the pagination's landmark must be unique for axe). */
const useCopyLabel = (label: string) => `${label} ${useId()}`;

function Patients() {
  const [page, setPage] = useState(1);
  return (
    <DataTable
      aria-label={useCopyLabel('قائمة المرضى')}
      columns={PATIENT_COLUMNS}
      rows={PATIENTS}
      getRowId={(p) => p.id}
      selectable
      defaultSelected={[PATIENTS[1]?.id ?? '', PATIENTS[3]?.id ?? '']}
      defaultSort={{ columnId: 'visit', direction: 'descending' }}
      onRowAction={() => undefined}
      footer={
        <Pagination
          label={useCopyLabel('ترقيم الصفحات')}
          page={page}
          onPageChange={setPage}
          pageSize={25}
          totalItems={312}
        />
      }
    />
  );
}

/** Patients: sorted by last visit, two selected, numbers at the end, a badge column. */
export const PatientList: Story = { render: () => <Patients /> };

/** 5,000 invoices, only the rows in view drawn; the paid column hidden (the columns menu brings it back). */
export const Invoices: Story = {
  render: () => (
    <DataTable
      aria-label={useCopyLabel('الفواتير')}
      columns={INVOICE_COLUMNS}
      rows={INVOICES}
      getRowId={(r) => r.id}
      defaultHiddenColumns={['paid']}
    />
  ),
};

/** Loading: skeleton rows, the grid busy. */
export const Loading: Story = {
  render: () => (
    <DataTable
      aria-label={useCopyLabel('قائمة المرضى')}
      columns={PATIENT_COLUMNS}
      rows={[]}
      getRowId={(p) => p.id}
      selectable
      loading
    />
  ),
};

/** Empty: the empty state under the header. */
export const Empty: Story = {
  render: () => (
    <DataTable
      aria-label={useCopyLabel('قائمة المرضى')}
      columns={PATIENT_COLUMNS}
      rows={[]}
      getRowId={(p) => p.id}
      empty={{
        icon: 'magnifying-glass',
        title: 'لا مرضى بهذا الاسم',
        description: 'جرّب رقم الهاتف أو رقم الملف.',
      }}
    />
  ),
};
