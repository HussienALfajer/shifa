// Playgrounds of the components A-02 added: UsageChart, MultiCombobox and PageBanner (playground.ts
// has the rest and the rules).
import { choose, field, flag, NONE, once, type Playground, pick, text } from './controls.ts';
import { ANNOUNCEMENTS, CLINICS, USAGE, usageDays } from './sheets-a02.ts';

export const A02_PLAYGROUNDS: Record<string, Playground> = {
  UsageChart: {
    base: { unit: USAGE.unit },
    controls: [
      choose(
        'days',
        {
          busy: USAGE.days,
          quiet: usageDays([
            0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0,
            1,
          ]),
          none: [],
        },
        { busy: 'a busy clinic', quiet: 'a small clinic', none: 'no data yet' },
      ),
      text('aria-label', USAGE['aria-label']),
      flag('lastIsToday', true),
      flag('loading'),
    ],
    scenarios: [
      { label: 'No data yet', set: { days: 'none' } },
      { label: 'Loading', set: { loading: true } },
    ],
  },
  MultiCombobox: {
    base: { items: CLINICS },
    controls: [
      ...field('العيادات المختارة', 'ابحث بالاسم واختر عيادة أو أكثر.'),
      text('placeholder', 'ابحث عن عيادة'),
      text('emptyMessage', 'لا عيادة بهذا الاسم'),
      flag('disabled'),
      once(flag('defaultOpen')),
      once(text('defaultInputValue', '')),
      once(
        choose(
          'defaultValue',
          { none: undefined, two: [CLINICS[0]?.value ?? '', CLINICS[4]?.value ?? ''] },
          { none: 'none', two: 'two chosen' },
        ),
      ),
    ],
    scenarios: [
      { label: 'Two chosen', set: { defaultValue: 'two' } },
      { label: 'Open', set: { defaultOpen: true, defaultInputValue: 'عب' } },
      { label: 'Error', set: { error: 'اختر عيادة واحدة على الأقل.' } },
    ],
  },
  PageBanner: {
    base: {},
    controls: [
      pick('tone', ['warning', 'info', 'support']),
      text('title', 'تنبيه:'),
      text('text', ANNOUNCEMENTS[0] ?? ''),
      pick('icon', [NONE, 'eye', 'info', 'warning', 'bell']),
      text('action', ''),
      choose(
        'texts',
        { one: undefined, three: ANNOUNCEMENTS },
        { one: 'one', three: 'three in turn' },
      ),
      flag('dismissible', true),
    ],
    scenarios: [
      { label: 'Several', set: { tone: 'info', title: 'معلومة:', texts: 'three' } },
      {
        label: 'Owner’s notice',
        set: {
          tone: 'warning',
          icon: 'eye',
          title: 'فريق شفاء يقرأ عيادتك الآن، للقراءة فقط.',
          text: 'السبب: مشكلة في الفروع · حتى 14:12',
          action: 'إنهاء الدخول',
          dismissible: false,
        },
      },
      {
        label: 'Support session',
        set: {
          tone: 'support',
          title: 'دخول الدعم · للقراءة فقط',
          action: 'إنهاء',
          dismissible: false,
        },
      },
    ],
  },
};
