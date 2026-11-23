// Start-up check: every controller route handler carries exactly one of @Public, @SignedIn,
// @RequirePermission or @PlatformAdmin, and @BeforeMfa only together with @SignedIn. Runs on
// application bootstrap (inside configureApp's app.init()), so the production server, the boot
// check and every test app refuse to start otherwise.
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  BEFORE_MFA_METADATA,
  PERMISSION_METADATA,
  PLATFORM_ADMIN_METADATA,
  PUBLIC_METADATA,
  SIGNED_IN_METADATA,
} from './decorators.ts';
import {
  assertGrantsKnown,
  PERMISSION_CATALOGUE,
  type PermissionCatalogue,
  UnknownPermissionError,
} from './permissions.ts';
import type { RoleGrants } from './roles.ts';

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
}

export function readAccess(reflector: Reflector, handler: object): AccessAnnotations {
  const flag = (key: string) => reflector.get<unknown>(key, handler as never) === true;
  const permission = reflector.get<unknown>(PERMISSION_METADATA, handler as never);
  return {
    isPublic: flag(PUBLIC_METADATA),
    permission: typeof permission === 'string' ? permission : undefined,
    signedIn: flag(SIGNED_IN_METADATA),
    platformAdmin: flag(PLATFORM_ADMIN_METADATA),
    beforeMfa: flag(BEFORE_MFA_METADATA),
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
  ) {}

  onApplicationBootstrap(): void {
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
      }
    }
    return problems.sort();
  }
}
