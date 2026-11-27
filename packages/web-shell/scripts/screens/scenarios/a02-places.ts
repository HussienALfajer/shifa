// A branch's city and area (A-02-10, contract rows "Branch dialog · city and area", "· save" and
// "Branch cards"; approved board `A02cBranchPlace`): the cards read «حلب · الفرقان», «منطقة
// مؤرشفة» or «لم تُحدَّد المدينة»; in the dialog the city is searched with the Arabic fold, the area
// waits for its city and follows it, a city without areas says so, an archived area the branch
// holds stays with its note; the server's refusals of a place are field errors. The states join
// the Branches sheet (branches.ts).
import type { Scenario, Step, World } from '../scenario.ts';
import { fail } from '../server.ts';
import { B_SECOND } from '../world.ts';
import { KALLASEH } from '../world-a02-clinic.ts';

const branches = (s: Omit<Scenario, 'path'>): Scenario => ({ path: '/branches', ...s });
const dialog = (s: Omit<Scenario, 'path' | 'overlay'>): Scenario =>
  branches({ overlay: true, ...s });

const addDialog: Step[] = [{ press: 'branchesAdd' }, { until: 'branchAddTitle' }];
/** «تعديل» of the n-th active card: 0 the main branch, 1 the second. */
const edit = (nth: number): Step[] => [{ press: 'branchEdit', nth }];
const city = (typed: string): Step => ({ fill: 'placeCity', value: typed });
const area = (typed: string): Step => ({ fill: 'placeArea', value: typed });
const choose = (name: string): Step => ({ pressText: name });
const PATCH = 'PATCH /branches/:id';

/** The second branch holds an area archived since it was chosen. */
const heldArchived = (w: World) => {
  const b = w.branches.find((x) => x.id === B_SECOND.id);
  if (b) b.area = { ...KALLASEH, archived: true };
};

export const branchPlaces: Scenario[] = [
  dialog({
    id: 'PlaceCityTyping',
    title: 'إضافة فرع: البحث عن المدينة',
    steps: [...addDialog, city('حل')],
  }),
  dialog({
    id: 'PlaceAreaTyping',
    title: 'إضافة فرع: المنطقة بعد المدينة',
    steps: [...addDialog, city('حلب'), choose('حلب'), area('الشهبا')],
  }),
  dialog({
    id: 'PlaceAreaNone',
    title: 'مدينة بلا مناطق بعد',
    steps: [...addDialog, city('اعزاز'), choose('أعزاز'), area('الشهباء')],
  }),
  dialog({
    id: 'PlaceEdit',
    title: 'تعديل فرع: مدينته ومنطقته',
    steps: edit(0),
  }),
  dialog({
    id: 'PlaceArchivedHeld',
    title: 'منطقة مؤرشفة يحملها الفرع: تبقى',
    world: heldArchived,
    steps: edit(1),
  }),
  branches({
    id: 'PlaceArchivedCard',
    title: 'بطاقة فرع بمنطقة مؤرشفة',
    world: heldArchived,
  }),
  branches({
    id: 'PlaceSaved',
    title: 'حُفظت منطقة الفرع',
    steps: [...edit(0), area('الشهباء'), choose('الشهباء'), { press: 'save' }, { wait: 600 }],
  }),
  dialog({
    id: 'PlaceArchivedRefused',
    title: 'رفض الخادم: أُرشفت المنطقة في الأثناء',
    answers: { [PATCH]: [fail(409, 'place_archived', { place: 'area' })] },
    steps: [
      ...edit(0),
      area('الشهباء'),
      choose('الشهباء'),
      { press: 'save' },
      { until: 'placeAreaArchived' },
    ],
  }),
  dialog({
    id: 'PlaceNotInCity',
    title: 'رفض الخادم: المنطقة ليست في المدينة',
    answers: {
      [PATCH]: [
        fail(400, 'validation_failed', {
          details: [{ path: 'body.areaId', code: 'area_not_in_city' }],
        }),
      ],
    },
    steps: [
      ...edit(0),
      area('الشهباء'),
      choose('الشهباء'),
      { press: 'save' },
      { until: 'placeAreaNotInCity' },
    ],
  }),
];
