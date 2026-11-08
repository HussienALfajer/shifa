// Orchestrator probes. Bodies never carry host, version or error text.
import { z } from 'zod';
import { defineContract } from './define.ts';
import { ErrorEnvelope } from './errors.ts';

export const HealthStatus = z.object({ status: z.literal('ok') }).meta({ id: 'HealthStatus' });
export type HealthStatus = z.infer<typeof HealthStatus>;

/** Process is up; never touches the database. */
export const healthLive = defineContract({
  operationId: 'healthLive',
  method: 'GET',
  path: '/health/live',
  summary: 'Liveness probe',
  responses: { 200: HealthStatus },
});

/** Database reachable as shifa_app; 503 otherwise. */
export const healthReady = defineContract({
  operationId: 'healthReady',
  method: 'GET',
  path: '/health/ready',
  summary: 'Readiness probe',
  responses: { 200: HealthStatus, 503: ErrorEnvelope },
});
