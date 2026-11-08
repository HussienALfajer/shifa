// Start-up check: every controller route handler carries exactly one of @Public or
// @RequirePermission. Runs on application bootstrap (inside configureApp's app.init()), so the
// production server, the boot check and every test app refuse to start otherwise.
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { PERMISSION_METADATA, PUBLIC_METADATA } from './decorators.ts';

export class AccessAnnotationError extends Error {
  override name = 'AccessAnnotationError';
}

@Injectable()
export class AccessCheck implements OnApplicationBootstrap {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const problems = this.problems();
    if (problems.length > 0) {
      throw new AccessAnnotationError(
        `Every route handler needs exactly one of @Public() or @RequirePermission(key):\n${problems.join('\n')}`,
      );
    }
  }

  /** One line per handler that is unannotated or annotated both ways. */
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
        const isPublic = this.reflector.get<unknown>(PUBLIC_METADATA, handler) === true;
        const hasKey = this.reflector.get<unknown>(PERMISSION_METADATA, handler) !== undefined;
        const label = `${String(wrapper.name)}.${name}`;
        if (!isPublic && !hasKey) problems.push(`  ${label}: no access annotation`);
        if (isPublic && hasKey) problems.push(`  ${label}: both @Public and @RequirePermission`);
      }
    }
    return problems.sort();
  }
}
