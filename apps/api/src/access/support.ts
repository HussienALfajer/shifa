// The support session's request audit (A-02 criterion 14, ADR-0050): the guard records every
// request of a support session (method, route template, target id; never a body or a query) before
// any other check, refused writes included. access/ never imports a module, so the recorder comes
// through this port, provided by the support module (SUPPORT_AUDIT) and looked up from the whole
// application when first needed, as the GatePort is. Without a provider a support principal is
// refused with 500 (fail-closed): no support request goes unaudited.
import type { ModuleRef } from '@nestjs/core';
import type { Principal } from './principal.ts';

export interface SupportRequest {
  method: string;
  /** The route template (`/team/members/:id`), never the URL. */
  route: string;
  /** The path's `:id` when it is a UUID; otherwise null. */
  targetId: string | null;
  /** The API's request id. */
  requestId: string | undefined;
}

export interface SupportAuditPort {
  /** One `support.request` row in the clinic, committed before the handler runs. */
  recordRequest(principal: Principal, request: SupportRequest): Promise<void>;
}

/** Injection token of the SupportAuditPort. */
export const SUPPORT_AUDIT = Symbol('SUPPORT_AUDIT');

export class SupportAuditMissingError extends Error {
  override name = 'SupportAuditMissingError';
  constructor() {
    super('a support session reached the guard but no SupportAuditPort is provided');
  }
}

/** The application's SupportAuditPort, or null when no module provides one. */
export function findSupportAudit(moduleRef: ModuleRef): SupportAuditPort | null {
  try {
    return moduleRef.get<SupportAuditPort>(SUPPORT_AUDIT, { strict: false });
  } catch {
    return null;
  }
}
