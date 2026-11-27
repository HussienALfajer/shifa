// Slice A-02-09 review fixes: with every city archived the page still offers «عرض المؤرشفة», so
// they can be restored (finding 1, criterion 15); an add sends one request however often Enter is
// pressed (finding 2); the rename and archive questions say «في عيادتين» (finding 8).
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AFRIN, ALEPPO, a02Api, dialog, must, rowWith, SHAHBA } from './a02-admin-support.ts';
import { openAdmin } from './admin-support.ts';
import { button, click, flush, type Rendered, type as typeInto } from './render.tsx';
import { json } from './support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const text = () => document.body.textContent;

describe('Admin web: cities and areas, review fixes', () => {
  it('every city archived: the switch stays and shows them with «استعادة»', async () => {
    shown = await openAdmin(a02Api({ cities: [], archivedCities: [AFRIN] }), '/places');
    await flush(60);
    expect(text()).toContain('لا مدن بعد');
    await click(must(shown.container.querySelector('[role="switch"]')));
    await flush(40);
    const afrin = must(rowWith(AFRIN.name));
    expect(afrin.textContent).toContain('مؤرشفة');
    expect(() => button(afrin, 'استعادة')).not.toThrow();
  });

  it('Enter twice while adding sends one request', async () => {
    const fake = a02Api();
    let release: (r: Response) => void = () => undefined;
    fake.answers['/api/platform/cities'] = (body) =>
      body === undefined
        ? json(200, { cities: [ALEPPO] })
        : new Promise<Response>((resolve) => {
            release = resolve;
          });
    shown = await openAdmin(fake, '/places');
    await flush(60);
    const input = must(document.querySelector<HTMLInputElement>('input[aria-label="مدينة جديدة"]'));
    await typeInto(input, 'منبج');
    const form = must(input.closest('form'));
    await act(async () => {
      form.requestSubmit();
      form.requestSubmit();
      await Promise.resolve();
    });
    release(json(201, { ...AFRIN, archivedAt: null, name: 'منبج' }));
    await flush(40);
    expect(fake.bodies['/api/platform/cities']).toHaveLength(1);
  });

  it('two clinics read «في عيادتين» in the archive question', async () => {
    const two = { ...SHAHBA, clinicCount: 2, branchCount: 2 };
    shown = await openAdmin(a02Api({ cities: [{ ...ALEPPO, areas: [two] }] }), '/places');
    await flush(60);
    await click(button(must(rowWith(SHAHBA.name)), `إجراءات ${SHAHBA.name}`));
    for (const item of document.querySelectorAll<HTMLElement>('[role="menuitem"]')) {
      if (item.textContent.includes('أرشفة')) await click(item);
    }
    expect(dialog()?.textContent).toContain('فرعان، في عيادتين');
  });
});
