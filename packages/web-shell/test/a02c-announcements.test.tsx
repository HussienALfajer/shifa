// Slice A-02-10 checkpoint 3: the announcement banner above every page of clinic web, as the owner
// approved it on 2026-11-27 (board `A02cAnnouncements`): GET /me/announcements as PageBanner,
// warning first then newest (the server's order), «1 من 3» with previous and next, «إخفاء الإعلان»
// sends its version and shows the next one or goes; 404 (ended meanwhile) drops it; every member
// sees it; below the owner's support banner.
import { afterEach, describe, expect, it } from 'vitest';
import { must } from './a02-admin-support.ts';
import {
  ANNOUNCEMENTS_PATH,
  banner,
  dismissPath,
  INFO_ONE,
  INFO_TWO,
  OPEN_GRANT,
  WARNING,
  withA02,
} from './a02c-support.ts';
import { button, click, flush, type Rendered, renderShell } from './render.tsx';
import { errorAnswer, json } from './support.ts';
import { DOCTOR_SESSION, teamApi } from './team-support.ts';

let shown: Rendered | undefined;
afterEach(async () => {
  await shown?.unmount();
  shown = undefined;
});

const NAME = 'إعلان من شفاء';

async function open(api: ReturnType<typeof teamApi>, path = '/') {
  shown = await renderShell('clinic', api, path);
  await flush(60);
  return shown;
}

describe('announcements', () => {
  it('shows one warning with its level word and no pager', async () => {
    await open(withA02(teamApi(), { announcements: [WARNING] }));
    const strip = banner(NAME);
    expect(strip?.textContent).toContain('تنبيه:');
    expect(strip?.textContent).toContain(WARNING.body);
    expect(strip?.textContent).not.toContain('1 من 1');
  });

  it('is shown to every member, not only owners', async () => {
    await open(withA02(teamApi({ session: DOCTOR_SESSION }), { announcements: [INFO_ONE] }));
    expect(banner(NAME)?.textContent).toContain('معلومة:');
  });

  it('pages through several: «1 من 3», next, previous', async () => {
    await open(withA02(teamApi(), { announcements: [WARNING, INFO_ONE, INFO_TWO] }));
    const strip = () => must(banner(NAME));
    expect(strip().textContent).toContain('1 من 3');
    expect(strip().textContent).toContain(WARNING.body);
    await click(button(strip(), 'الإعلان التالي'));
    expect(strip().textContent).toContain('2 من 3');
    expect(strip().textContent).toContain(INFO_ONE.body);
    await click(button(strip(), 'الإعلان السابق'));
    expect(strip().textContent).toContain(WARNING.body);
  });

  it('hides one with its version and shows the next', async () => {
    const api = withA02(teamApi(), { announcements: [WARNING, INFO_ONE] });
    await open(api);
    await click(button(must(banner(NAME)), 'إخفاء الإعلان'));
    await flush(40);
    expect(api.bodies[dismissPath(WARNING.id)]).toEqual([{ version: WARNING.version }]);
    expect(banner(NAME)?.textContent).toContain(INFO_ONE.body);
    expect(banner(NAME)?.textContent).not.toContain(WARNING.body);
  });

  it('goes when the last one is hidden', async () => {
    await open(withA02(teamApi(), { announcements: [INFO_ONE] }));
    await click(button(must(banner(NAME)), 'إخفاء الإعلان'));
    await flush(40);
    expect(banner(NAME)).toBeNull();
  });

  it('drops one that ended meanwhile (404)', async () => {
    const api = withA02(teamApi(), { announcements: [INFO_ONE] });
    api.answers[dismissPath(INFO_ONE.id)] = () => {
      api.answers[ANNOUNCEMENTS_PATH] = () => json(200, { announcements: [] });
      return errorAnswer(404, 'not_found');
    };
    await open(api);
    await click(button(must(banner(NAME)), 'إخفاء الإعلان'));
    await flush(40);
    expect(banner(NAME)).toBeNull();
  });

  it('sits under the owner’s support banner', async () => {
    const r = await open(withA02(teamApi(), { announcements: [INFO_ONE], open: [OPEN_GRANT] }));
    const regions = [...r.container.querySelectorAll('[role="region"]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(regions.indexOf('دخول الدعم')).toBeLessThan(regions.indexOf(NAME));
  });

  it('shows nothing when the list is empty', async () => {
    await open(withA02(teamApi()));
    expect(banner(NAME)).toBeNull();
  });
});
