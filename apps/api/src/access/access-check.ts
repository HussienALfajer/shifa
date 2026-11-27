// Start-up check: every controller route handler carries exactly one of @Public, @SignedIn,
// @RequirePermission or @PlatformAdmin, and @BeforeMfa only together with @SignedIn. Runs on
// application bootstrap (inside configureApp's app.init()), so the production server, the boot
// check and every test app refuse to start otherwise.
import { Inject, Injectable, type OnApplicationBootstrap, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, ModuleRef, Reflector } from '@nestjs/core';
import {
  BEFORE_MFA_METADATA,
  ENTITLEMENT_GATE_METADATA,
  FLAG_GATE_METADATA,
  NOT_IN_SUPPORT_METADATA,
  PERMISSION_METADATA,
  PLATFORM_ADMIN_METADATA,
  PUBLIC_METADATA,
  READ_IN_BODY_METADATA,
  SIGNED_IN_METADATA,
  SUPPORT_WRITE_METADATA,
} from './decorators.ts';
import { findGates, type GatePort } from './gates.ts';
import {
  assertGrantsKnown,
  PERMISSION_CATALOGUE,
  type PermissionCatalogue,
  UnknownPermissionError,
} from './permissions.ts';
import type { RoleGrants } from './roles.ts';

/** The only handler that may carry @SupportSessionWrite: `POST /auth/support/end` (A-02-05). */
export const SUPPORT_END_HANDLER = 'SupportEndController.end';

/** Injection token of the role grants (production: PRODUCTION_GRANTS). */
export const ROLE_GRANTS = Symbol('ROLE_GRANTS');

export class AccessAnnotationError extends Error {
  override name = 'AccessAnnotationError';
}

/** The access annotations a handler carries, read the way the guard reads them. */
export interface AccessAnnotations {
  isPublic: boolean;
  permission: string | undefined;
  signedIn: boolean;
  platformAdmin: boolean;
  beforeMfa: boolean;
  /** @RequireEntitlement(key) (A-02-03). */
  entitlementGate: string | undefined;
  /** @RequireFlag(key) (A-02-03). */
  flagGate: string | undefined;
  /** @SupportSessionWrite (A-02-05): the one write a support session may make. */
  supportWrite: boolean;
  /** @NotInSupportSession (A-02-05): an owner's read a support session may not make. */
  notInSupport: boolean;
  /** @ReadInBody (A-03-03): a POST that only reads; a support session may call it. */
  readInBody: boolean;
}

export function readAccess(reflector: Reflector, handler: object): AccessAnnotations {
  const flag = (key: string) => reflector.get<unknown>(key, handler as never) === true;
  const text = (key: string) => {
    const value = reflector.get<unknown>(key, handler as never);
    return typeof value === 'string' ? value : undefined;
  };
  return {
    isPublic: flag(PUBLIC_METADATA),
    permission: text(PERMISSION_METADATA),
    signedIn: flag(SIGNED_IN_METADATA),
    platformAdmin: flag(PLATFORM_ADMIN_METADATA),
    beforeMfa: flag(BEFORE_MFA_METADATA),
    entitlementGate: text(ENTITLEMENT_GATE_METADATA),
    flagGate: text(FLAG_GATE_METADATA),
    supportWrite: flag(SUPPORT_WRITE_METADATA),
    notInSupport: flag(NOT_IN_SUPPORT_METADATA),
    readInBody: flag(READ_IN_BODY_METADATA),
  };
}

/** How many of the four access annotations a handler carries (exactly one is valid). */
export function annotationCount(a: AccessAnnotations): number {
  return [a.isPublic, a.permission !== undefined, a.signedIn, a.platformAdmin].filter(Boolean)
    .length;
}

@Injectable()
export class AccessCheck implements OnApplicationBootstrap {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PERMISSION_CATALOGUE) private readonly catalogue: PermissionCatalogue,
    @Inject(ROLE_GRANTS) private readonly grants: RoleGrants,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
  ) {}

  onApplicationBootstrap(): void {
    const gates = this.gateProblems(findGates(this.moduleRef));
    if (gates.length > 0) {
      throw new AccessAnnotationError(
        '@RequireEntitlement(key) and @RequireFlag(key) need @RequirePermission(key) and a key ' +
          `from the entitlement (a feature) or flag catalogue:\n${gates.join('\n')}`,
      );
    }
    // Grants naming a key outside the catalogue stop the start (A-01b criterion 7).
    assertGrantsKnown(this.catalogue, this.grants);
    const unknown = this.unknownKeys();
    if (unknown.length > 0) {
      throw new UnknownPermissionError(
        `@RequirePermission names keys outside the catalogue:\n${unknown.join('\n')}`,
      );
    }
    const problems = this.problems();
    if (problems.length > 0) {
      throw new AccessAnnotationError(
        'Every route handler needs exactly one of @Public(), @SignedIn(), @RequirePermission(key) ' +
          `or @PlatformAdmin(), and @BeforeMfa() only with @SignedIn():\n${problems.join('\n')}`,
      );
    }
  }

  /** `Controller.method: key` for every @RequirePermission key the catalogue does not list. */
  unknownKeys(): string[] {
    return this.#handlers()
      .filter(({ access }) => access.permission !== undefined)
      .filter(({ access }) => !this.catalogue.has(access.permission ?? ''))
      .map(({ label, access }) => `  ${label}: ${access.permission ?? ''}`)
      .sort();
  }

  /** One line per gate on a route without a permission check, or naming an unknown key. */
  gateProblems(gates: GatePort): string[] {
    const problems: string[] = [];
    for (const { label, access } of this.#handlers()) {
      const { entitlementGate: feature, flagGate: flag } = access;
      if ((feature !== undefined || flag !== undefined) && access.permission === undefined) {
        problems.push(`  ${label}: a gate without @RequirePermission`);
      }
      if (feature !== undefined && !gates.knowsFeature(feature)) {
        problems.push(`  ${label}: unknown feature ${feature}`);
      }
      if (flag !== undefined && !gates.knowsFlag(flag)) {
        problems.push(`  ${label}: unknown flag ${flag}`);
      }
    }
    return problems.sort();
  }

  #handlers(): { label: string; access: AccessAnnotations }[] {
    const found: { label: string; access: AccessAnnotations }[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      const metatype = wrapper.metatype as { prototype?: unknown } | null | undefined;
      const prototype = metatype?.prototype as Record<string, unknown> | undefined;
      if (!prototype) continue;
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        if (this.reflector.get<unknown>(PATH_METADATA, handler) === undefined) continue;
        found.push({
          label: `${String(wrapper.name)}.${name}`,
          access: readAccess(this.reflector, handler),
        });
      }
    }
    return found;
  }

  /** One line per handler that is unannotated, annotated twice or marked @BeforeMfa wrongly. */
  problems(): string[] {
    const problems: string[] = [];
    for (const wrapper of this.discovery.getControllers()) {
      // Read the class, not the instance: a controller without an instance must not slip past.
      const metatype = wrapper.metatype as { prototype?: unknown } | null | undefined;
      const prototype = metatype?.prototype as Record<string, unknown> | undefined;
      if (!prototype) {
        problems.push(`  ${String(wrapper.name)}: controller class not found`);
        continue;
      }
      for (const name of this.scanner.getAllMethodNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== 'function') continue;
        // Nest routes on path metadata alone (no method → all methods), so check the same way.
        const isRoute = this.reflector.get<unknown>(PATH_METADATA, handler) !== undefined;
        if (!isRoute) continue;
        const access = readAccess(this.reflector, handler);
        const label = `${String(wrapper.name)}.${name}`;
        const count = annotationCount(access);
        if (count === 0) problems.push(`  ${label}: no access annotation`);
        if (count > 1) problems.push(`  ${label}: more than one access annotation`);
        if (access.beforeMfa && !access.signedIn) {
          problems.push(`  ${label}: @BeforeMfa without @SignedIn`);
        }
        if (access.supportWrite && (!access.signedIn || access.beforeMfa)) {
          problems.push(`  ${label}: @SupportSessionWrite without @SignedIn (or with @BeforeMfa)`);
        }
        // The one write a support session may make is ending its own grant (A-02-05 review 9).
        if (access.supportWrite && label !== SUPPORT_END_HANDLER) {
          problems.push(`  ${label}: @SupportSessionWrite on a route other than the support end`);
        }
        // A read by POST (A-03-03) is a tenant read behind a permission, never a GET or a write.
        const method = this.reflector.get<unknown>(METHOD_METADATA, handler);
        if (
          access.readInBody &&
          (access.permission === undefined || method !== RequestMethod.POST)
        ) {
          problems.push(`  ${label}: @ReadInBody without @RequirePermission on a POST`);
        }
      }
    }
    return problems.sort();
  }
}
