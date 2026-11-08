// Turns "no container runtime" failures into one actionable message.

export const DOCKER_MISSING =
  'Database tests need Docker. Start Docker Desktop (or the Docker daemon) and run the tests ' +
  'again; see packages/db/CLAUDE.md.';

// testcontainers: "Could not find a working container runtime strategy" when no Docker is found.
const RUNTIME_MISSING = /could not find a working container runtime strategy/i;

/** The error to report when starting the container failed. */
export function explainStartFailure(err: unknown): unknown {
  const text = err instanceof Error ? err.message : String(err);
  return RUNTIME_MISSING.test(text) ? new Error(DOCKER_MISSING, { cause: err }) : err;
}
