// The active clinic's name and whether it is solo, for the pages that need them (slice A-02-10).
// A member reads them from GET /me/clinics; a support session has no membership there (404
// `no_clinic`), so its clinic's name comes with the session and "solo" from the plan's count of
// active branches (GET /clinic/capabilities), the way the frame decides on «الفروع».
import { useActiveClinic } from './account/data.ts';
import { BRANCHES, useCapabilities } from './capabilities.ts';
import type { SessionView } from './session.ts';

export interface ClinicFacts {
  /** Whether `solo` is known yet. */
  known: boolean;
  solo: boolean;
  name: string | undefined;
}

export function useClinicFacts(session: SessionView | undefined): ClinicFacts {
  const clinic = useActiveClinic(session);
  const caps = useCapabilities(session?.tenantId);
  const support = session?.support;
  if (support) {
    const used = caps.data?.limits.find((l) => l.key === BRANCHES)?.used ?? 0;
    return { known: caps.isFetched, solo: used <= 1, name: support.clinicName };
  }
  return { known: clinic !== undefined, solo: clinic?.solo === true, name: clinic?.name };
}
