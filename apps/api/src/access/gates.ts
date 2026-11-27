// Route gates (A-02 criterion 5; ADR-0007): @RequireEntitlement and @RequireFlag, checked by the
// guard after the permission, in the scope it checked. access/ never imports a module, so what a
// clinic has comes through the GatePort, which the capabilities module provides (GATE_PORT). It is
// looked up from the whole application when first needed: AccessModule does not import the module
// that provides it (that module reads tenant data through TenantDb, which AccessModule exports).
// Without a provider nothing is known, so any gated route stops the start (fail-closed).
import type { ModuleRef } from '@nestjs/core';
import type { RequestScope } from './scope.ts';

export interface GatePort {
  /** The key is in the entitlement catalogue and is a feature (on/off). */
  knowsFeature(key: string): boolean;
  /** The key is in the flag catalogue. */
  knowsFlag(key: string): boolean;
  /** The feature is on for the scope's clinic. */
  entitled(scope: RequestScope, key: string): Promise<boolean>;
  /** The flag is on for the scope's clinic (a failed read answers off). */
  flagOn(scope: RequestScope, key: string): Promise<boolean>;
}

/** Injection token of the GatePort. */
export const GATE_PORT = Symbol('GATE_PORT');

/** No provider: no key is known, nothing is on. */
export const NO_GATES: GatePort = {
  knowsFeature: () => false,
  knowsFlag: () => false,
  entitled: () => Promise.resolve(false),
  flagOn: () => Promise.resolve(false),
};

/** The application's GatePort, or NO_GATES when no module provides one. */
export function findGates(moduleRef: ModuleRef): GatePort {
  try {
    return moduleRef.get<GatePort>(GATE_PORT, { strict: false });
  } catch {
    return NO_GATES;
  }
}
