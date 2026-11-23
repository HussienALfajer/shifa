// Cross-site request guard (A-01-02 security review M1). Calling Better Auth through `auth.api.*`
// skips its own origin check, and the session cookie travels with top-level form posts
// (SameSite=Lax), so another site could sign a visitor in to the attacker's account (login CSRF),
// sign them out, or spray sign-ins from many browsers. For every unsafe method, before routing:
// - a browser's `Sec-Fetch-Site` must say `same-origin` (or `none`: typed by the user) → else 403;
// - a body may only be JSON (forms and text/plain need no CORS preflight) → else 415.
// Clients without Sec-Fetch-Site (the Flutter app, scripts) pass the first rule; same-site origins
// (other subdomains) wait for an origin allowlist with CORS (backlog, web shells A-01-06).
import type { FastifyInstance } from 'fastify';
import { envelopeFor } from './errors.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_FETCH_SITES = new Set(['same-origin', 'none']);

export function registerRequestGuard(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (request, reply, done) => {
    if (SAFE_METHODS.has(request.method)) {
      done();
      return;
    }
    const site = request.headers['sec-fetch-site'];
    if (typeof site === 'string' && !ALLOWED_FETCH_SITES.has(site.toLowerCase())) {
      request.log.info({ status: 403, reason: 'cross-site' }, 'request refused');
      void reply.code(403).send(envelopeFor(403));
      return;
    }
    const contentType = request.headers['content-type'];
    const mediaType = contentType?.split(';')[0]?.trim().toLowerCase();
    if (mediaType !== undefined && mediaType !== '' && mediaType !== 'application/json') {
      request.log.info({ status: 415 }, 'request refused');
      void reply.code(415).send(envelopeFor(415));
      return;
    }
    done();
  });
}
