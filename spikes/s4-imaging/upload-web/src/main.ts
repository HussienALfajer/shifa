// Throwaway upload page (0.3-S4b, criterion 8): pick a study folder, upload it through the
// gateway by the chunked resumable protocol or by STOW-RS per instance. Mode and chunk size
// come from the query (?mode=chunked|stow&chunk=bytes); the token comes from the application.
import { uploadChunked } from './chunked.ts';
import { buildManifest } from './manifest.ts';
import { type Mode, report, stats } from './stats.ts';
import { uploadStow } from './stow.ts';

const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node;
};
const folder = $('folder') as HTMLInputElement;
const modeSelect = $('mode') as HTMLSelectElement;
const start = $('start') as HTMLButtonElement;
const status = $('status');
const skippedList = $('skipped');

const query = new URLSearchParams(location.search);
const queryMode = query.get('mode');
if (queryMode === 'chunked' || queryMode === 'stow') modeSelect.value = queryMode;
const chunkParam = Number(query.get('chunk'));
const chunk = Number.isSafeInteger(chunkParam) && chunkParam > 0 ? chunkParam : null;

const show = (state: 'idle' | 'running' | 'done' | 'failed', text: string) => {
  status.dataset['state'] = state;
  status.textContent = text;
};

start.addEventListener('click', () => {
  void (async () => {
    const files = [...(folder.files ?? [])];
    if (files.length === 0) return;
    start.disabled = true;
    const mode = modeSelect.value as Mode;
    stats.mode = mode;
    show('running', 'تحضير قائمة الملفات…');
    try {
      const { items, skipped } = await buildManifest(files);
      stats.files = items.length;
      stats.skipped.push(...skipped);
      show('running', `جارٍ رفع ${String(items.length)} ملفًا…`);
      let ok = true;
      if (mode === 'chunked') await uploadChunked(items, chunk);
      else ok = await uploadStow(items);
      stats.skipped = [...new Set(stats.skipped)];
      for (const path of stats.skipped) {
        const li = document.createElement('li');
        li.textContent = path;
        skippedList.append(li);
      }
      stats.outcome = ok ? 'done' : 'failed';
      await report();
      show(stats.outcome, ok ? 'اكتمل الرفع' : 'تعذّر رفع بعض الملفات');
    } catch {
      stats.outcome = 'failed';
      await report().catch(() => undefined);
      show('failed', 'تعذّر الرفع');
    }
  })();
});
