import { deploymentRoute } from '../../../src/index.ts';
import { defineIsolationCase } from '../define.ts';

// Read-only for shifa_app (classification access 'read-only'): the runner seeds it as the owner
// inside each tenant's context and expects every shifa_app write refused by privileges.
export const deploymentRouteCase = defineIsolationCase({
  table: 'deployment_route',
  seed: async (tx, tenantId) => {
    await tx.insert(deploymentRoute).values({ tenantId, databaseKey: 'primary' });
  },
  paths: {
    "the tenant's route": (tx) => tx.select().from(deploymentRoute),
  },
});
