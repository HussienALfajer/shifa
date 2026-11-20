// The RTL gate components of slice 0.4-04 (ADR-0039), shared by the gate-table and public-API tests.
/** The eight gate components (ADR-0039), by folder and by the name the results table uses. */
export const GATE_COMPONENTS = [
  { dir: 'tabs', name: 'Tabs' },
  { dir: 'dialog', name: 'Dialog' },
  { dir: 'popover', name: 'Popover' },
  { dir: 'menu', name: 'Menu' },
  { dir: 'select', name: 'Select' },
  { dir: 'combobox', name: 'Combobox' },
  { dir: 'number-input', name: 'Number Input' },
  { dir: 'date-picker', name: 'Date Picker' },
] as const;
