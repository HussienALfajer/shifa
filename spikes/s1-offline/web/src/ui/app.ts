// Prototype shell: login, offline banner (SCH-33), screens, remaps and conflicts list.
import type { Command, SyncEngine, SyncEvent } from '../engine.ts';
import { appointmentsSection } from './appointments.ts';
import { cashSection } from './cash.ts';
import type { Ctx, StoredSession } from './context.ts';
import { field, formatDuration, h, kids } from './dom.ts';
import { queueSection } from './queue.ts';

const SESSION_KEY = 's1-session';
const DEVICE_KEY = 's1-device';

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev-${crypto.randomUUID().slice(0, 6)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function loadSession(): StoredSession | undefined {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as StoredSession) : undefined;
}

async function login(username: string): Promise<StoredSession | undefined> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) return undefined;
  const body = (await res.json()) as Omit<StoredSession, 'deviceId' | 'username'>;
  const session = { ...body, username, deviceId: deviceId() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function eventText(e: SyncEvent): string {
  if (e.kind === 'remap')
    return `تغيّر رقم الدور: المؤقت ${String(e.provisional)} ← النهائي ${String(e.real)}`;
  return `${e.kind === 'conflict' ? 'تعارض' : 'مرفوض'}: ${e.messageAr}`;
}

export function mountApp(root: HTMLElement, engine: SyncEngine): void {
  let session = loadSession();
  let lastSnapshot = '';
  let banner: HTMLElement | undefined;

  const ctx = (s: StoredSession, today: Ctx['today']): Ctx => ({
    engine,
    session: s,
    today,
    offline: () => engine.status().state !== 'online',
    envelope: (): Pick<Command, 'id' | 'deviceId' | 'offline' | 'clientTime'> => ({
      id: crypto.randomUUID(),
      deviceId: s.deviceId,
      offline: engine.status().state !== 'online',
      clientTime: new Date().toISOString(),
    }),
    async submit(command) {
      await engine.enqueue(command);
      await render(true);
      await engine.sync();
      await render(true);
    },
    rerender: () => void render(true),
  });

  async function updateBanner(): Promise<void> {
    if (!banner) return;
    const status = engine.status();
    const pending = await engine.pendingCount();
    banner.className = `banner ${status.state}`;
    banner.dataset['state'] = status.state;
    const label = {
      online: 'متصل',
      offline: 'دون اتصال',
      'needs-login': 'انتهت الجلسة — سجّل الدخول للمزامنة',
    }[status.state];
    banner.replaceChildren(
      ...kids(
        h('strong', { 'data-testid': 'sync-state' }, label),
        h(
          'span',
          {},
          'مدة الانقطاع: ',
          h(
            'span',
            { 'data-testid': 'offline-for' },
            status.offlineSince === undefined
              ? '0:00:00'
              : formatDuration(Date.now() - status.offlineSince),
          ),
        ),
        h(
          'span',
          {},
          'بانتظار المزامنة: ',
          h('span', { 'data-testid': 'pending-count' }, String(pending)),
        ),
        status.state === 'needs-login'
          ? h(
              'button',
              { type: 'button', 'data-testid': 'relogin', onclick: () => void relogin() },
              'تسجيل الدخول',
            )
          : undefined,
        h(
          'button',
          { type: 'button', 'data-testid': 'logout', onclick: () => void logout() },
          'خروج',
        ),
      ),
    );
  }

  async function relogin(): Promise<void> {
    if (!session) return;
    const next = await login(session.username);
    if (!next) return;
    session = next;
    await engine.start(next);
    await engine.sync();
    await render(true);
  }

  async function logout(): Promise<void> {
    await engine.wipe();
    localStorage.removeItem(SESSION_KEY);
    session = undefined;
    await render(true);
  }

  function loginScreen(): HTMLElement {
    const form = h('form', { 'data-testid': 'login-form' }) as HTMLFormElement;
    const user = h(
      'select',
      { name: 'username' },
      h('option', { value: 'reception-a' }, 'استقبال — عيادة أ'),
      h('option', { value: 'reception-b' }, 'استقبال — عيادة ب'),
    );
    form.append(
      h('label', {}, 'المستخدم (اصطناعي)', user),
      h('button', { type: 'submit' }, 'دخول'),
    );
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      void (async () => {
        const s = await login(field(form, 'username'));
        if (!s) return;
        session = s;
        await engine.start(s);
        await engine.sync();
        await render(true);
      })();
    });
    return h('main', {}, h('h1', {}, 'نموذج الاستقبال — تسجيل الدخول'), form);
  }

  async function render(force = false): Promise<void> {
    if (!session) {
      banner = undefined;
      root.replaceChildren(loginScreen());
      return;
    }
    const today = await engine.today();
    const events = await engine.events();
    const snapshot = JSON.stringify([today, events]);
    const typing = document.activeElement instanceof HTMLInputElement;
    if (force || (snapshot !== lastSnapshot && !typing)) {
      lastSnapshot = snapshot;
      const c = ctx(session, today);
      banner = h('div', { class: 'banner', 'data-testid': 'banner' });
      root.replaceChildren(
        banner,
        h(
          'main',
          {},
          h('h1', {}, `الاستقبال — الجهاز ${session.deviceId}`),
          h(
            'div',
            { class: 'grid' },
            queueSection(c),
            h('div', {}, appointmentsSection(c), cashSection(c)),
          ),
          h(
            'section',
            { 'data-testid': 'events' },
            h('h2', {}, 'تغييرات الأرقام والتعارضات'),
            h(
              'ul',
              { class: 'events' },
              ...events.map((e) => h('li', { 'data-kind': e.kind }, eventText(e))),
            ),
          ),
        ),
      );
    }
    await updateBanner();
  }

  void (async () => {
    if (session) await engine.start(session);
    await render(true);
    if (session) await engine.sync();
    setInterval(() => void render(), 1_000);
  })();
}
