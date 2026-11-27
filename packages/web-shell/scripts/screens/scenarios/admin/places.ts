// «المدن والمناطق» on admin web (/places, A-02-09): the cities and the areas of the chosen one, the
// Arabic-folded search, «عرض المؤرشفة» and «استعادة», adding a city or an area
// (src/admin/places/places-page.tsx, place-parts.tsx), and a place's rename and archive
// (place-dialogs.tsx).
import type { Answer, Scenario, Sheet, Step } from '../../scenario.ts';
import { fail } from '../../server.ts';

const GET = 'GET /platform/cities';
const page = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/places', ...s });
const dialog = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/places', overlay: true, ...s });

const ALERT = '[role="alertdialog"]';
const search = (value: string): Step => ({ fillIn: 'input[type="search"]', value });
const archived: Step = { click: '[role="switch"]' };
const restore = (name: string): Step => ({ press: 'placesRestoreOf', values: { name } });
const newCity = (value: string): Step[] => [
  { fillIn: 'input[aria-label="مدينة جديدة"]', value },
  { press: 'placesAdd', nth: 0 },
];
const newArea = (value: string): Step[] => [
  { fillIn: 'input[aria-label="منطقة جديدة"]', value },
  { press: 'placesAdd', nth: 1 },
];
const menu = (name: string, item: 'placesRename' | 'placesArchive'): Step[] => [
  { press: 'placesActions', values: { name } },
  { press: item },
];
/** The dialog's one field (its label ends with the required mark). */
const named = (value: string): Step => ({ fillIn: '[role="dialog"] input', value });
const save: Step = { press: 'save' };
const archive: Step = { press: 'placesArchive', within: ALERT };
/** The place was archived or removed meanwhile: the world agrees, then the refusal. */
const archivedMeanwhile =
  (code: string, status = 409): Answer =>
  (request, world) => {
    for (const city of world.adminA02.cities) {
      const place = city.id === request.id ? city : city.areas.find((a) => a.id === request.id);
      if (place) place.archivedAt = new Date().toISOString();
    }
    return fail(status, code);
  };

export const placesSheet: Sheet = {
  id: 'Places',
  title: 'المدن والمناطق',
  route: '/places',
  note: 'The cities and the areas of the chosen one, each with how many branches hold it, in how many clinics, with how many doctors (counts only); a city without areas; «عرض المؤرشفة» with «استعادة»; the search on the client with the Arabic fold («الشهبا» finds «الشهباء»), and no match; adding a city or an area (added, an empty name, a name that exists in the city, a name the server cannot read); no city yet, loading and a failed read; a restore refused or without network.',
  code: ['admin/places/places-page.tsx', 'admin/places/place-parts.tsx', 'admin/places/data.ts'],
  scenarios: [
    page({ id: 'Aleppo', title: 'حلب ومناطقها' }),
    page({ id: 'Azaz', title: 'مدينة بلا مناطق', steps: [{ pressText: 'أعزاز' }] }),
    page({ id: 'Archived', title: 'عرض المؤرشفة', steps: [archived, { until: 'placesRestore' }] }),
    page({
      id: 'Restored',
      title: 'استُعيدت منطقة مؤرشفة',
      steps: [archived, restore('الكلاسة'), { until: 'placesRestoredText' }],
    }),
    page({
      id: 'RestoreServerError',
      title: 'الاستعادة: خطأ في الخادم',
      answers: { 'POST /platform/areas/:id/restore': fail(500, 'internal_error') },
      steps: [archived, restore('الكلاسة'), { until: 'actionFailedTitle' }],
    }),
    page({
      id: 'RestoreOffline',
      title: 'الاستعادة: لا اتصال',
      answers: { 'POST /platform/cities/:id/restore': 'offline' },
      steps: [archived, restore('عفرين'), { until: 'unreachableTitle' }],
    }),
    page({ id: 'Search', title: 'بحث عربي: «الشهبا» يجد «الشهباء»', steps: [search('الشهبا')] }),
    page({
      id: 'SearchNone',
      title: 'لا مدينة ولا منطقة بهذا الاسم',
      steps: [search('دمشق'), { until: 'placesNoMatchTitle' }],
    }),
    page({
      id: 'Empty',
      title: 'لا مدن بعد',
      world: (w) => {
        w.adminA02.cities = [];
      },
    }),
    page({ id: 'Loading', title: 'تحميل المدن', answers: { [GET]: 'hold' } }),
    page({ id: 'Offline', title: 'تعذّر التحميل: لا اتصال', answers: { [GET]: 'offline' } }),
    page({
      id: 'ServerError',
      title: 'تعذّر التحميل: خطأ في الخادم',
      answers: { [GET]: fail(500, 'internal_error') },
    }),
    page({
      id: 'CityAdded',
      title: 'أُضيفت مدينة',
      steps: [...newCity('الباب'), { until: 'placesAddedTitle', values: { name: 'الباب' } }],
    }),
    page({
      id: 'AreaAdded',
      title: 'أُضيفت منطقة لحلب',
      steps: [...newArea('الميدان'), { until: 'placesAddedTitle', values: { name: 'الميدان' } }],
    }),
    page({ id: 'AddEmpty', title: 'إضافة دون اسم', steps: [{ press: 'placesAdd', nth: 1 }] }),
    page({
      id: 'AddTaken',
      title: 'اسم موجود: «الجميليه» هي «الجميلية»',
      steps: [
        ...newArea('الجميليه'),
        { until: 'placesTakenArea', values: { name: 'الجميليه', city: 'حلب' } },
      ],
    }),
    page({
      id: 'AddInvalid',
      title: 'اسم لا يقرؤه الخادم: مرفوض',
      steps: [...newCity('ـــ'), { until: 'placesNameMissing' }],
    }),
  ],
};

export const placeDialogsSheet: Sheet = {
  id: 'PlaceDialogs',
  title: 'إعادة تسمية مكان وأرشفته',
  route: '/places',
  note: 'From a place’s menu: rename it (how many branches and clinics show the new name, a name that exists in the city, an empty name, a name the server cannot read, saving, saved, gone meanwhile, no network) and archive it (the question with the branches and clinics that keep it, archived, archived meanwhile, no network kept in the question).',
  code: ['admin/places/place-dialogs.tsx'],
  scenarios: [
    dialog({ id: 'Rename', title: 'إعادة التسمية', steps: menu('الشهباء', 'placesRename') }),
    dialog({
      id: 'RenameNone',
      title: 'إعادة تسمية مكان لا تحمله فروع',
      steps: menu('السبيل', 'placesRename'),
    }),
    dialog({
      id: 'RenameEmpty',
      title: 'اسم فارغ',
      steps: [...menu('الشهباء', 'placesRename'), named(''), save],
    }),
    dialog({
      id: 'RenameTaken',
      title: 'اسم موجود في المدينة',
      steps: [
        ...menu('الشهباء', 'placesRename'),
        named('العزيزيه'),
        save,
        { until: 'placesTakenArea', values: { name: 'العزيزيه', city: 'حلب' } },
      ],
    }),
    dialog({
      id: 'RenameInvalid',
      title: 'اسم لا يقرؤه الخادم',
      steps: [
        ...menu('الشهباء', 'placesRename'),
        named('ـــ'),
        save,
        { until: 'placesNameMissing' },
      ],
    }),
    dialog({
      id: 'RenameSaving',
      title: 'جارٍ الحفظ',
      answers: { 'PATCH /platform/areas/:id': 'hold' },
      steps: [...menu('الشهباء', 'placesRename'), named('الشهباء الجديدة'), save],
    }),
    dialog({
      id: 'RenameOffline',
      title: 'لم يصل الرد: يبقى الاسم',
      answers: { 'PATCH /platform/areas/:id': ['offline'] },
      steps: [
        ...menu('الشهباء', 'placesRename'),
        named('الشهباء الجديدة'),
        save,
        { until: 'unreachableTitle' },
      ],
    }),
    page({
      id: 'Renamed',
      title: 'تغيّر الاسم',
      steps: [
        ...menu('حلب', 'placesRename'),
        named('حلب الشهباء'),
        save,
        { until: 'placesRenamedTitle', values: { name: 'حلب الشهباء' } },
      ],
    }),
    page({
      id: 'RenameGone',
      title: 'لم يعد المكان: يُغلق ويُذكر',
      answers: { 'PATCH /platform/areas/:id': fail(404, 'not_found') },
      steps: [
        ...menu('الشهباء', 'placesRename'),
        named('الشهباء الجديدة'),
        save,
        { until: 'placesStaleTitle' },
      ],
    }),
    dialog({ id: 'ArchiveAsk', title: 'الأرشفة: السؤال', steps: menu('الشهباء', 'placesArchive') }),
    dialog({
      id: 'ArchiveOffline',
      title: 'الأرشفة: لم يصل الرد',
      answers: { 'POST /platform/areas/:id/archive': ['offline'] },
      steps: [...menu('الشهباء', 'placesArchive'), archive, { until: 'unreachableTitle' }],
    }),
    page({
      id: 'Archived',
      title: 'أُرشفت المنطقة',
      steps: [...menu('الشهباء', 'placesArchive'), archive, { until: 'placesArchivedText' }],
    }),
    page({
      id: 'ArchivedMeanwhile',
      title: 'أُرشفت في الأثناء',
      answers: { 'POST /platform/cities/:id/archive': archivedMeanwhile('place_archived') },
      steps: [...menu('أعزاز', 'placesArchive'), archive, { until: 'placesStaleTitle' }],
    }),
  ],
};
