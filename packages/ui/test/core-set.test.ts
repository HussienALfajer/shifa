// Spec 0.4 criterion 8 (slice 0.4-07, the Phase 0.4 web exit check): every component of the core
// set is exported from @shifa/ui and has a story file, so Storybook holds the whole set and CI's
// story run (interaction and axe) and screenshots cover it.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as ui from '../src/index.ts';

const src = join(import.meta.dirname, '..', 'src');

/** Criterion 8 in order: the export and the folder of its story. */
const CORE_SET = [
  ['Button', 'button'],
  ['IconButton', 'icon-button'],
  ['Input', 'input'],
  ['Textarea', 'textarea'],
  ['PasswordInput', 'password-input'],
  ['NumberInput', 'number-input'],
  ['OtpInput', 'otp-input'],
  ['Select', 'select'],
  ['Combobox', 'combobox'],
  ['Checkbox', 'checkbox'],
  ['RadioGroup', 'radio'],
  ['Switch', 'switch'],
  ['SegmentedControl', 'segmented-control'],
  ['Field', 'field'],
  ['Form', 'form'],
  ['DatePicker', 'date-picker'],
  ['TimeInput', 'time-input'],
  ['Dialog', 'dialog'],
  ['AlertDialog', 'alert-dialog'],
  ['Drawer', 'drawer'],
  ['Popover', 'popover'],
  ['Menu', 'menu'],
  ['Tooltip', 'tooltip'],
  ['Tabs', 'tabs'],
  ['Accordion', 'accordion'],
  ['ToastProvider', 'toast'],
  ['Avatar', 'avatar'],
  ['Badge', 'badge'],
  ['Card', 'card'],
  ['Toolbar', 'toolbar'],
  ['Pagination', 'pagination'],
  ['Skeleton', 'skeleton'],
  ['EmptyState', 'empty-state'],
  ['CommandPalette', 'command-palette'],
  ['DataTable', 'data-table'],
] as const;

describe('the core set of criterion 8', () => {
  it.each(CORE_SET)('%s is exported and has stories', (name, folder) => {
    expect(typeof (ui as Record<string, unknown>)[name], name).toBe('function');
    expect(existsSync(join(src, folder, `${folder}.stories.tsx`)), `${folder}.stories.tsx`).toBe(
      true,
    );
  });
});
