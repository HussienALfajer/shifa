// The gateway's route allowlist (criterion 6). Anything not matched here is refused (404)
// before authentication and before any upstream call. Paths are matched on the raw request
// target: dot segments, encoded slashes or dots, backslashes and empty segments are refused
// outright, never normalised.

export type Role = 'viewer' | 'uploader' | 'edge';
export type Action = 'search' | 'retrieve' | 'store';

export interface Route {
  routeClass: string;
  method: 'GET' | 'POST';
  pattern: RegExp;
  action: Action;
  roles: readonly Role[];
  /** Query string allowed (QIDO filters). */
  query: boolean;
}

export interface Match {
  route: Route;
  /** Path after /dicomweb, for the upstream /dicom-web root. */
  upstreamPath: string;
  query: string;
  studyUid: string | null;
}

const UID = '([0-9]+(?:\\.[0-9]+){1,63})';
const READERS: readonly Role[] = ['viewer', 'uploader'];
const r = (
  routeClass: string,
  method: Route['method'],
  path: string,
  action: Action,
  roles: readonly Role[] = READERS,
  query = false,
): Route => ({
  routeClass,
  method,
  pattern: new RegExp(`^/dicomweb${path}$`),
  action,
  roles,
  query,
});

const S = `/studies/${UID}`;
const SE = `${S}/series/${UID}`;
const I = `${SE}/instances/${UID}`;

export const ROUTES: readonly Route[] = [
  r('qido-studies', 'GET', '/studies', 'search', READERS, true),
  r('qido-series', 'GET', `${S}/series`, 'search', READERS, true),
  r('qido-study-instances', 'GET', `${S}/instances`, 'search', READERS, true),
  r('qido-instances', 'GET', `${SE}/instances`, 'search', READERS, true),
  r('wado-study', 'GET', S, 'retrieve'),
  r('wado-study-metadata', 'GET', `${S}/metadata`, 'retrieve'),
  r('wado-study-rendered', 'GET', `${S}/rendered`, 'retrieve', READERS, true),
  r('wado-series', 'GET', SE, 'retrieve'),
  r('wado-series-metadata', 'GET', `${SE}/metadata`, 'retrieve'),
  r('wado-series-rendered', 'GET', `${SE}/rendered`, 'retrieve', READERS, true),
  r('wado-instance', 'GET', I, 'retrieve'),
  r('wado-instance-metadata', 'GET', `${I}/metadata`, 'retrieve'),
  r('wado-instance-rendered', 'GET', `${I}/rendered`, 'retrieve', READERS, true),
  r('wado-frames', 'GET', `${I}/frames/([0-9]{1,6}(?:,[0-9]{1,6}){0,63})`, 'retrieve'),
  r('wado-frames-rendered', 'GET', `${I}/frames/([0-9]{1,6})/rendered`, 'retrieve', READERS, true),
  r('stow', 'POST', '/studies', 'store', ['uploader']),
];

/** Query strings: QIDO keys and values only (letters, digits and a few separators). */
const SAFE_QUERY = /^[A-Za-z0-9=&*.,:_\-%^ +]*$/;

export function matchRoute(method: string, target: string): Match | null {
  const q = target.indexOf('?');
  const path = q === -1 ? target : target.slice(0, q);
  const query = q === -1 ? '' : target.slice(q + 1);
  if (/%|\\|\/\/|\/\.\.?(\/|$)/.test(path)) return null;
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const m = route.pattern.exec(path);
    if (!m) continue;
    if (query && (!route.query || !SAFE_QUERY.test(query) || /%2[fF]|%2[eE]|%5[cC]/.test(query))) {
      return null;
    }
    return {
      route,
      upstreamPath: path.slice('/dicomweb'.length),
      query,
      studyUid:
        route.routeClass === 'stow' || route.routeClass === 'qido-studies' ? null : (m[1] ?? null),
    };
  }
  return null;
}
