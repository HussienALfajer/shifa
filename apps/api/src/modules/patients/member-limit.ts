// A per-member request budget (spec A-03, "Money, abuse and privacy": scraping through search is
// bounded by a per-member rate limit). One process, kept in memory (ADR-0052); each route family
// holds its own window so the registration form's checks do not use up search.
import type { RequestScope } from '../../access/index.ts';
import type { Clock } from '../../platform/clock.ts';

export interface Budget {
  readonly max: number;
  readonly windowMs: number;
}

export class MemberLimit {
  readonly #windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly budget: Budget,
    private readonly clock: Clock,
  ) {}

  /** False past `budget.max` calls in a window, per member of a clinic. */
  take(scope: RequestScope): boolean {
    const now = this.clock.now().getTime();
    const id = `${scope.tenantId}:${scope.userId}`;
    const window = this.#windows.get(id);
    if (!window || now - window.start >= this.budget.windowMs) {
      if (this.#windows.size > 10_000) this.#prune(now);
      this.#windows.set(id, { start: now, count: 1 });
      return true;
    }
    window.count += 1;
    return window.count <= this.budget.max;
  }

  #prune(now: number): void {
    for (const [id, w] of this.#windows) {
      if (now - w.start >= this.budget.windowMs) this.#windows.delete(id);
    }
  }
}
