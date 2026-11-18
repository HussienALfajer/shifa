// Pre-round (criterion 2): six Chirp 3 HD voices under neutral labels (صوت ١ … صوت ٦), five phrases
// each. The owner picks one male and one female voice; the choice downloads only when both are set.
import type { ListeningSet } from '@shifa-spike/s6-tts';
import { arabicDigits, button, h } from './dom.ts';
import { buildChoice, download } from './export.ts';
import type { Player } from './player.ts';
import { loadPreRound, savePreRound } from './state.ts';

type PreRoundSet = Extract<ListeningSet, { kind: 'pre-round' }>;

const GENDER = { male: 'صوت رجل', female: 'صوت امرأة' } as const;

export function startPreRound(root: HTMLElement, set: PreRoundSet, player: Player): void {
  const progress = loadPreRound(set.setHash);

  const render = () => {
    const voices = [...set.voices].sort((a, b) => a.label - b.label);
    const cards = voices.map((v) => {
      const picked = progress[v.gender] === v.label;
      return h(
        'section',
        { class: `card${picked ? ' picked' : ''}`, 'data-testid': `voice-${String(v.label)}` },
        h('h2', {}, `صوت ${arabicDigits(v.label)}`),
        h('p', { class: 'muted' }, GENDER[v.gender]),
        h(
          'ol',
          { class: 'phrases' },
          ...v.clips.map((c) =>
            h(
              'li',
              {},
              button(
                `استمع: ${set.phrases[c.phrase - 1] ?? ''}`,
                `play-${String(v.label)}-${String(c.phrase)}`,
                () => void player.play([c.code], [c.file]),
                { className: 'play' },
              ),
            ),
          ),
        ),
        button(
          picked ? 'مختار' : 'اختر هذا الصوت',
          `pick-${String(v.label)}`,
          () => {
            progress[v.gender] = v.label;
            savePreRound(progress);
            render();
          },
          { pressed: picked, className: 'pick' },
        ),
      );
    });
    const ready = progress.male !== null && progress.female !== null;
    root.replaceChildren(
      h('h1', {}, 'الجولة التمهيدية: اختيار صوتين'),
      h(
        'p',
        {},
        'استمع إلى العبارات الخمس لكل صوت، ثم اختر صوت رجل واحداً وصوت امرأة واحدة. لا تظهر أسماء الأصوات ولا مزوّدوها.',
      ),
      h('div', { class: 'grid' }, ...cards),
      h(
        'p',
        { class: 'actions' },
        button(
          'تنزيل الاختيار',
          'download-choice',
          () => {
            if (progress.male === null || progress.female === null) return;
            download(
              'pre-round-choice.json',
              buildChoice(set.setHash, progress.male, progress.female),
            );
          },
          { disabled: !ready, className: 'primary' },
        ),
      ),
    );
  };
  render();
}
