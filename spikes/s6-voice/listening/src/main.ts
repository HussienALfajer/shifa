// The blind listening page (criterion 5). Static: it reads only listening-set.json and the clips
// from its own origin. Rating: naturalness 1-5 per clip and, for numbers and names, correct /
// wrong with an optional note; then 20 pairs of full announcements; then the results download.
// ?mode=pre-round shows the pre-round instead (criterion 2).
import type { ListeningSet } from '@shifa-spike/s6-tts';
import { arabicDigits, button, h } from './dom.ts';
import { buildResults, download } from './export.ts';
import { createPlayer } from './player.ts';
import { startPreRound } from './preround.ts';
import { clearProgress, loadProgress, type Progress, rating, saveProgress } from './state.ts';

type FullSet = Extract<ListeningSet, { kind: 'full' }>;
type Phase = 'loading' | 'rating' | 'pairs' | 'done' | 'pre-round' | 'error';

const root = document.querySelector<HTMLElement>('#app') ?? document.body;
const player = createPlayer();
let phase: Phase = 'loading';
let progress: Progress | null = null;
let fullSet: FullSet | null = null;
/** Code of the clip on screen that failed to load, if any. */
let loadError: string | null = null;

const CATEGORY: Record<string, string> = {
  number: 'رقم',
  name: 'اسم (مشكول)',
  'name-plain': 'اسم (بلا تشكيل)',
  room: 'عبارة العيادة',
  doctor: 'عبارة الطبيب',
};

function hook() {
  const p = progress;
  const ratings: Record<string, { naturalness: number; wrong: boolean | null; note: string }> = {};
  for (const [code, r] of Object.entries(p?.ratings ?? {})) {
    if (r.naturalness !== null) {
      ratings[code] = { naturalness: r.naturalness, wrong: r.wrong, note: r.note };
    }
  }
  return {
    phase,
    index: phase === 'pairs' ? (p?.pairIndex ?? 0) : (p?.index ?? 0),
    total: phase === 'pairs' ? (fullSet?.pairs.length ?? 0) : (fullSet?.items.length ?? 0),
    ratings,
    pairs: Object.fromEntries(Object.entries(p?.pairs ?? {}).map(([id, c]) => [id, c.choice])),
    events: player.events,
  };
}
(window as unknown as { __s6l: unknown }).__s6l = { state: hook };

function save(): void {
  if (progress) saveProgress(progress);
}

function playCurrent(set: FullSet, p: Progress): void {
  const item = set.items[p.index];
  if (!item) return;
  loadError = null;
  // Shown with the start button until the browser lets audio start.
  if (player.suspended()) render();
  player.play([item.code], [item.file]).then(
    (completed) => {
      // A clip counts as heard only when it played to its end.
      if (completed && set.items[p.index]?.code === item.code) {
        rating(p, item.code).heard = true;
        save();
        render();
      }
    },
    () => {
      if (set.items[p.index]?.code !== item.code) return;
      loadError = item.code;
      render();
    },
  );
}

/** A clip that will not load or decode: move on without a rating for it. */
function skip(set: FullSet, p: Progress): void {
  const item = set.items[p.index];
  if (item) delete p.ratings[item.code];
  p.index += 1;
  if (p.index >= set.items.length) {
    p.index = set.items.length;
    p.phase = 'pairs';
  }
  save();
  render();
  if (p.phase === 'rating') playCurrent(set, p);
}

function canAdvance(set: FullSet, p: Progress): boolean {
  const item = set.items[p.index];
  const r = item ? p.ratings[item.code] : undefined;
  if (!item || r?.naturalness === null || r?.naturalness === undefined) return false;
  return item.text === undefined || r.wrong !== null;
}

function next(set: FullSet, p: Progress): void {
  if (!canAdvance(set, p)) return;
  p.index += 1;
  if (p.index >= set.items.length) {
    p.index = set.items.length;
    p.phase = 'pairs';
  }
  save();
  render();
  if (p.phase === 'rating') playCurrent(set, p);
}

function renderRating(set: FullSet, p: Progress): HTMLElement {
  const item = set.items[p.index];
  if (!item) return h('p', {}, 'لا مقاطع');
  const r = rating(p, item.code);
  const judged = item.text !== undefined;
  const heard = r.heard;
  const set1 = (patch: Partial<typeof r>) => {
    Object.assign(r, patch, { at: new Date().toISOString() });
    save();
    render();
  };
  const scores = [1, 2, 3, 4, 5].map((n) =>
    button(
      arabicDigits(n),
      `score-${String(n)}`,
      () => {
        set1({ naturalness: n });
      },
      {
        pressed: r.naturalness === n,
        disabled: !heard,
        className: 'score',
        ariaLabel: `طبيعية الصوت ${arabicDigits(n)} من ٥`,
      },
    ),
  );
  const note = h('textarea', {
    'data-testid': 'note',
    rows: '2',
    maxlength: '500',
    placeholder: 'ملاحظة (اختياري): ماذا سمعت؟',
    oninput: (e: Event) => {
      r.note = (e.target as HTMLTextAreaElement).value;
      save();
    },
  });
  note.value = r.note;
  return h(
    'section',
    {
      class: 'card',
      'data-testid': 'rating',
      'data-judged': String(judged),
      'data-code': item.code,
    },
    h(
      'p',
      { class: 'muted' },
      `المقطع ${arabicDigits(p.index + 1)} من ${arabicDigits(set.items.length)} · رمز ${item.code} · ${CATEGORY[item.category] ?? ''}`,
    ),
    judged
      ? h('p', { class: 'text', 'data-testid': 'text' }, item.text ?? '')
      : h('p', { class: 'text', 'data-testid': 'text', hidden: true }),
    player.suspended() && !heard
      ? button(
          'ابدأ: تفعيل الصوت',
          'start',
          () => {
            playCurrent(set, p);
          },
          { className: 'primary' },
        )
      : null,
    loadError === item.code
      ? h(
          'p',
          { role: 'alert' },
          'تعذّر تحميل هذا المقطع. ',
          button('تخطَّ المقطع (لا يُسجَّل له تقييم)', 'skip', () => {
            skip(set, p);
          }),
        )
      : null,
    button('أعد الاستماع (مسافة)', 'replay', () => {
      playCurrent(set, p);
    }),
    h('h2', {}, 'ما مدى طبيعية الصوت؟ (١ سيئ جداً … ٥ ممتاز)'),
    h('div', { class: 'row' }, ...scores),
    judged
      ? h(
          'div',
          { class: 'row' },
          h('span', {}, 'هل النطق صحيح؟'),
          button(
            'صحيح (ص)',
            'correct',
            () => {
              set1({ wrong: false });
            },
            {
              pressed: r.wrong === false,
              disabled: !heard,
            },
          ),
          button(
            'خطأ (خ)',
            'wrong',
            () => {
              set1({ wrong: true });
            },
            {
              pressed: r.wrong === true,
              disabled: !heard,
            },
          ),
        )
      : null,
    note,
    h(
      'div',
      { class: 'row nav' },
      button(
        'السابق',
        'prev',
        () => {
          p.index = Math.max(0, p.index - 1);
          save();
          render();
          playCurrent(set, p);
        },
        { disabled: p.index === 0 },
      ),
      button(
        'التالي (Enter)',
        'next',
        () => {
          next(set, p);
        },
        {
          disabled: !canAdvance(set, p),
          className: 'primary',
        },
      ),
    ),
  );
}

function renderPair(set: FullSet, p: Progress): HTMLElement {
  const pair = set.pairs[p.pairIndex];
  if (!pair) return h('p', {}, 'لا مقارنات');
  // Every clip is a WAV (the builder refuses anything else).
  const files = (codes: string[]) => codes.map((c) => `clips/${c}.wav`);
  const choose = (choice: 'a' | 'b' | 'same') => {
    p.pairs[pair.id] = { choice, at: new Date().toISOString() };
    p.pairIndex += 1;
    if (p.pairIndex >= set.pairs.length) {
      p.phase = 'done';
      p.finishedAt = new Date().toISOString();
    }
    player.stop();
    save();
    render();
  };
  const chosen = p.pairs[pair.id]?.choice;
  return h(
    'section',
    { class: 'card', 'data-testid': 'pair', 'data-pair-id': pair.id },
    h(
      'p',
      { class: 'muted' },
      `المقارنة ${arabicDigits(p.pairIndex + 1)} من ${arabicDigits(set.pairs.length)}`,
    ),
    h('h2', {}, 'استمع إلى النداءين كاملين، ثم اختر الأفضل'),
    h(
      'div',
      { class: 'row' },
      button('استمع إلى النداء أ', 'play-a', () => void player.play(pair.a, files(pair.a))),
      button('استمع إلى النداء ب', 'play-b', () => void player.play(pair.b, files(pair.b))),
    ),
    h(
      'div',
      { class: 'row' },
      button(
        'النداء أ أفضل',
        'choose-a',
        () => {
          choose('a');
        },
        { pressed: chosen === 'a' },
      ),
      button(
        'النداء ب أفضل',
        'choose-b',
        () => {
          choose('b');
        },
        { pressed: chosen === 'b' },
      ),
      button(
        'متساويان',
        'choose-same',
        () => {
          choose('same');
        },
        { pressed: chosen === 'same' },
      ),
    ),
  );
}

function renderDone(set: FullSet, p: Progress): HTMLElement {
  return h(
    'section',
    { class: 'card', 'data-testid': 'done' },
    h('h2', {}, 'انتهى الاستماع. شكراً لك'),
    h('p', {}, 'نزّل ملف النتائج وأرسله كما في قائمة الخطوات. لا يحوي الملف اسمك ولا أي معرّف لك.'),
    button(
      'تنزيل النتائج',
      'download',
      () => {
        download(`s6-results-${set.setHash}.json`, buildResults(set, p));
      },
      { className: 'primary' },
    ),
  );
}

function render(): void {
  const set = fullSet;
  const p = progress;
  if (!set || !p) return;
  phase = p.phase;
  const view =
    p.phase === 'rating'
      ? renderRating(set, p)
      : p.phase === 'pairs'
        ? renderPair(set, p)
        : renderDone(set, p);
  root.replaceChildren(
    h('h1', {}, 'اختبار الاستماع (أعمى)'),
    document.body.dataset['storage'] === 'failed'
      ? h(
          'p',
          { role: 'alert', class: 'warn' },
          'تعذّر حفظ التقدّم في المتصفح: لا تُعِد تحميل الصفحة، وأكمل حتى تنزيل النتائج.',
        )
      : null,
    view,
    h(
      'p',
      { class: 'reset' },
      button('البدء من جديد', 'reset', () => {
        if (!window.confirm('سيُحذف كل ما قيّمته. هل تريد البدء من جديد؟')) return;
        if (!window.confirm('تأكيد أخير: حذف كل الإجابات؟')) return;
        clearProgress(set.setHash);
        progress = loadProgress(set.setHash);
        render();
        playCurrent(set, progress);
      }),
    ),
  );
  if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
}

function onKey(e: KeyboardEvent): void {
  const set = fullSet;
  const p = progress;
  if (!set || p?.phase !== 'rating' || e.target instanceof HTMLTextAreaElement) return;
  const item = set.items[p.index];
  if (!item) return;
  const r = rating(p, item.code);
  const digit = /^(?:Digit|Numpad)([1-5])$/u.exec(e.code)?.[1];
  const update = (patch: Partial<typeof r>) => {
    if (!r.heard) return;
    Object.assign(r, patch, { at: new Date().toISOString() });
    save();
    render();
  };
  if (digit) update({ naturalness: Number(digit) });
  else if (item.text !== undefined && (e.code === 'KeyW' || e.key === 'ص'))
    update({ wrong: false });
  else if (item.text !== undefined && (e.code === 'KeyO' || e.key === 'خ')) update({ wrong: true });
  else if (e.code === 'Space') playCurrent(set, p);
  else if (e.code === 'Enter') next(set, p);
  else return;
  e.preventDefault();
}

async function start(): Promise<void> {
  const preRound = new URLSearchParams(location.search).get('mode') === 'pre-round';
  try {
    const res = await fetch(preRound ? './pre-round-set.json' : './listening-set.json');
    if (!res.ok) throw new Error(String(res.status));
    const set = (await res.json()) as ListeningSet;
    if (set.kind === 'pre-round') {
      phase = 'pre-round';
      startPreRound(root, set, player);
      return;
    }
    fullSet = set;
    progress = loadProgress(set.setHash);
    document.addEventListener('keydown', onKey);
    render();
    if (progress.phase === 'rating') playCurrent(set, progress);
  } catch {
    phase = 'error';
    root.replaceChildren(
      h('h1', {}, 'اختبار الاستماع'),
      h(
        'p',
        { role: 'alert' },
        'لم تُبنَ مجموعة الاستماع بعد. اتبع الخطوة في قائمة الخطوات ثم أعد التحميل.',
      ),
    );
  }
}

void start();
