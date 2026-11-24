// A 400 `validation_failed` that names the phone field (slice A-01-10 checkpoint 3): the server
// could not read the owner's phone (`body.ownerPhone` at creation, `body.phone` when corrected).
export function phoneRefused(error: unknown, path: string): boolean {
  const body = error as { error?: { code?: unknown; details?: unknown } } | null | undefined;
  if (body?.error?.code !== 'validation_failed') return false;
  const details = body.error.details;
  return (
    Array.isArray(details) && details.some((d) => (d as { path?: unknown } | null)?.path === path)
  );
}
