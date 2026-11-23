// Command palette search through the shared Arabic folding (slice 0.4-12, criterion 5, OD-40):
// «ه» typed at the end of a word finds a name written with «ة», and the match is marked.
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { people, personWhere } from '../../test/fixtures.ts';
import { renderDir, typeArabic } from '../../test/support/index.ts';
import { foldArabic } from '../lib/fold-arabic.ts';
import { CommandPalette, normaliseForSearch } from './command-palette.tsx';

const marbuta = personWhere((given) => given.endsWith('ة'), { id: '4001', seed: 44 });
const others = people(2, { seed: 45 }).filter((p) => !p.name.startsWith(marbuta.name.charAt(0)));

describe.each(['rtl', 'ltr'] as const)('Command palette folding in %s', (dir) => {
  it('«…ه» finds the name written «…ة» and marks it', async () => {
    const screen = await renderDir(
      <CommandPalette
        triggerLabel="بحث"
        title="بحث وأوامر"
        inputLabel="ابحث عن مريض"
        groups={[
          {
            label: 'المرضى',
            items: [marbuta, ...others].map((p) => ({ value: p.id, label: p.name })),
          },
        ]}
        onAction={() => undefined}
        emptyText={() => 'لا نتائج'}
      />,
      { dir },
    );
    (screen.getByRole('button', { name: 'بحث' }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    const input = screen.getByRole('combobox').element() as HTMLInputElement;
    const given = marbuta.name.split(' ')[0] ?? '';
    await typeArabic(input, given.replace(/ة$/u, 'ه'));
    await expect
      .poll(
        () =>
          [...document.querySelectorAll('[role="option"]')]
            .filter((o) => o.closest('[hidden]') === null)
            .map((o) => o.querySelector('mark')?.textContent),
        { timeout: 1500 },
      )
      .toEqual([given]);
    await screen.unmount();
  });

  it('its default normaliser is the shared folding', () => {
    for (const text of ['فاطمة', 'أحمد', 'مُحَمَّد', 'مصطفى', '١٢٣']) {
      expect(normaliseForSearch(text)).toBe(foldArabic(text));
    }
  });
});
