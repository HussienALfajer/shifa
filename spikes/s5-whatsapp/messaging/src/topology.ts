// Role separation by configuration (criterion 10, MSG-09): exactly one platform session, with no
// clinic, in a container that runs no clinic session; every clinic session names its clinic.
// (container, session) is then the only routing key the webhook needs.
import type { SessionConfig } from './config.ts';

export function validateTopology(sessions: readonly SessionConfig[]): void {
  const names = new Set<string>();
  for (const s of sessions) {
    if (names.has(s.name)) throw new Error(`duplicate session ${s.name}`);
    names.add(s.name);
    if (s.role === 'platform' && s.clinicId !== null) {
      throw new Error('the platform session must not have a clinic id');
    }
    if (s.role === 'clinic' && !s.clinicId) throw new Error('a clinic session needs a clinic id');
  }
  const platforms = sessions.filter((s) => s.role === 'platform');
  if (platforms.length > 1) throw new Error('at most one platform session');
  for (const p of platforms) {
    if (sessions.some((s) => s.role === 'clinic' && s.container === p.container)) {
      throw new Error('the platform session needs its own container (no clinic session in it)');
    }
  }
}
