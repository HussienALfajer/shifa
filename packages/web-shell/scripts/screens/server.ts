// The fake server behind each board of the screens canvas: the shell's typed client sends its
// requests here instead of the network (its `fetch` option, as the page tests do). Routes answer
// from a world of synthetic data that changes as the person acts in Play; a scenario replaces any
// route's answer (an error, a lock, a request that never ends, a network that is down).
import { a02AdminRoutes } from './routes-a02-admin.ts';
import { a02ClinicRoutes } from './routes-a02-clinic.ts';
import { a02TabRoutes } from './routes-a02-tabs.ts';
import { authRoutes } from './routes-auth.ts';
import { clinicRoutes } from './routes-clinic.ts';
import { platformRoutes } from './routes-platform.ts';
import type { World } from './state.ts';

/** One answer: a status and JSON body, a request left waiting, or no network at all. */
export type Reply = { status: number; body?: unknown } | 'hold' | 'offline';

export interface Request {
  method: string;
  /** The path after `/api`, e.g. `/team/members/…`. */
  path: string;
  /** The `:id` of the route, when it has one. */
  id: string | undefined;
  /** Every `:name` segment of the route (`:id`, `:key`), decoded. */
  params: Record<string, string>;
  body: unknown;
  /** The query string (`?search=` of admin web's clinics). */
  query: URLSearchParams;
}

export type Route = (request: Request, world: World) => Reply;

/**
 * `METHOD /path` with `:name` for a path segment, e.g. `POST /team/members/:id/deactivate` or
 * `PUT /platform/clinics/:id/overrides/:key`.
 */
export type RouteTable = Record<string, Route>;

/** A scenario's answer for a route: fixed, computed, or one per call (then the route's own). */
export type Answer = Reply | ((request: Request, world: World) => Reply) | Reply[];

export const ok = (body?: unknown, status = 200): Reply => ({ status, body });
export const fail = (status: number, code: string, extra: Record<string, unknown> = {}): Reply => ({
  status,
  body: { error: { code, message: code, ...extra } },
});
export const lockFor = (code: string, ms: number): Reply =>
  fail(429, code, { until: new Date(Date.now() + ms).toISOString() });

const ROUTES: RouteTable = {
  ...authRoutes,
  ...clinicRoutes,
  ...platformRoutes,
  ...a02TabRoutes,
  ...a02AdminRoutes,
  ...a02ClinicRoutes,
};

function match(table: Record<string, unknown>, method: string, path: string) {
  for (const key of Object.keys(table)) {
    const [m, pattern] = key.split(' ');
    if (m !== method || pattern === undefined) continue;
    const parts = pattern.split('/');
    const given = path.split('/');
    if (parts.length !== given.length) continue;
    const params: Record<string, string> = {};
    const same = parts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(given[i] ?? '');
        return true;
      }
      return part === given[i];
    });
    if (same) return { key, id: params['id'], params };
  }
  return null;
}

export interface ServerOptions {
  world: World;
  answers?: Record<string, Answer>;
  /** How long each answer takes, so Play shows the loading states (default 350 ms). */
  latencyMs?: number;
}

const json = (reply: { status: number; body?: unknown }) =>
  new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
    status: reply.status,
    headers: {
      'content-type': 'application/json',
      date: new Date().toUTCString(),
    },
  });

export interface Server {
  /** The `fetch` of the board's shell client. */
  fetch: (input: globalThis.Request) => Promise<Response>;
  /** Resolves once no answer has been pending for half a second (a held request never counts). */
  settled: () => Promise<void>;
}

/**
 * The error codes and network failures this window's server has answered since the state began,
 * read by the check to hold each sheet to every answer its code handles (coverage.ts).
 */
export const answered = new Set<string>();

export function createServer({ world, answers = {}, latencyMs = 350 }: ServerOptions): Server {
  const queue = new Map<string, Reply[]>();
  for (const [key, answer] of Object.entries(answers)) {
    if (Array.isArray(answer)) queue.set(key, [...answer]);
  }
  let pending = 0;
  let lastDone = Date.now();
  const settled = async () => {
    const started = Date.now();
    while (Date.now() - started < 15_000) {
      if (pending === 0 && Date.now() - lastDone >= 500) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };
  const fetch = async (input: globalThis.Request): Promise<Response> => {
    pending += 1;
    try {
      return await answer(input);
    } finally {
      pending -= 1;
      lastDone = Date.now();
    }
  };
  const answer = async (input: globalThis.Request): Promise<Response> => {
    const url = new URL(input.url);
    const path = url.pathname.replace(/^\/api/, '');
    const text = input.method === 'GET' ? '' : await input.clone().text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    let reply: Reply = fail(404, 'not_found');
    const own = match(answers, input.method, path);
    const route = match(ROUTES, input.method, path);
    const request: Request = {
      method: input.method,
      path,
      id: own?.id ?? route?.id,
      params: own?.params ?? route?.params ?? {},
      body,
      query: url.searchParams,
    };
    const queued = own ? queue.get(own.key) : undefined;
    const answer = own ? answers[own.key] : undefined;
    if (queued && queued.length > 0) reply = queued.shift() ?? reply;
    else if (typeof answer === 'function') reply = answer(request, world);
    else if (answer !== undefined && !Array.isArray(answer)) reply = answer;
    else {
      const handler = route ? ROUTES[route.key] : undefined;
      if (handler) reply = handler(request, world);
    }
    // Every answered request is activity to the server: the idle limit starts again (the API's
    // sliding window), so «متابعة العمل» and Play keep a session alive as in the app.
    if (reply !== 'hold' && reply !== 'offline' && reply.status < 400 && world.session) {
      const ms = world.session.idleMinutes * 60_000;
      // In place: the reply may hold this very session (GET /auth/session), and must carry it.
      world.session.idleExpiresAt = new Date(Date.now() + ms).toISOString();
    }
    if (reply === 'offline') answered.add('offline');
    else if (reply !== 'hold') {
      const code = (reply.body as { error?: { code?: unknown } } | undefined)?.error?.code;
      if (typeof code === 'string') answered.add(code);
    }
    await new Promise((resolve) => setTimeout(resolve, latencyMs));
    // A held request never answers, and is not waited for: the board shows it loading.
    if (reply === 'hold') {
      pending -= 1;
      return new Promise<Response>(() => undefined);
    }
    if (reply === 'offline') throw new TypeError('Failed to fetch');
    return json(reply);
  };
  return { fetch, settled };
}
