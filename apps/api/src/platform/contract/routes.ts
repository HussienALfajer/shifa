// The registered route handlers, read from controller classes the way Nest routes them, with
// their contract and access annotation. Shared by the start-up check and the OpenAPI builder.
import { RequestMethod, type Type } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum.js';
import type { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { Contract } from '@shifa/contracts';
import { PERMISSION_METADATA, PUBLIC_METADATA } from '../../access/decorators.ts';
import { CONTRACT_METADATA } from './decorator.ts';

export interface RouteHandler {
  /** `Controller.method`, for error messages. */
  label: string;
  /** `GET`, `POST`, …; `ALL` for `@All()`; undefined for path-only routes (Nest mounts them). */
  method: string | undefined;
  /** Parameter decorators used by the handler: `BODY`, `QUERY`, `PARAM`, …; `CUSTOM` for own ones. */
  args: string[];
  /** `@Version()` on the handler or controller (not supported yet). */
  versioned: boolean;
  /** Nest-style path with `:name` parameters, always starting with `/`. */
  paths: string[];
  /** Status Nest answers on success: `@HttpCode()`, else 201 for POST and 200 otherwise. */
  successStatus: number;
  contract: Contract | undefined;
  public: boolean;
  permission: string | undefined;
}

export interface RouteDiscovery {
  discovery: DiscoveryService;
  scanner: MetadataScanner;
  reflector: Reflector;
}

function asList(value: unknown): string[] {
  if (value === undefined) return [''];
  return (Array.isArray(value) ? value : [value]).map(String);
}

/** Joins a controller and a handler path into `/a/b`; `/` for the root. */
export function joinPath(...parts: string[]): string {
  const segments = parts.flatMap((p) => p.split('/')).filter((s) => s !== '');
  return `/${segments.join('/')}`;
}

/** Kinds of the handler's parameter decorators, from Nest's route-argument metadata. */
function argumentKinds(metatype: Type, name: string): string[] {
  const metadata: unknown = Reflect.getMetadata(ROUTE_ARGS_METADATA, metatype, name);
  if (!metadata || typeof metadata !== 'object') return [];
  // Keys are `<RouteParamtypes>:<index>`, or `<id>__customRouteArgs__:<index>` for own decorators.
  const kinds = Object.keys(metadata).map((key) => {
    const type = Number(key.split(':')[0]);
    return Number.isInteger(type) ? (RouteParamtypes[type] ?? 'UNKNOWN') : 'CUSTOM';
  });
  return [...new Set(kinds)].sort();
}

/** Every route handler of every controller, sorted by label. */
export function routeHandlers({ discovery, scanner, reflector }: RouteDiscovery): RouteHandler[] {
  const handlers: RouteHandler[] = [];
  for (const wrapper of discovery.getControllers()) {
    // Read the class, not the instance: a controller without an instance must not slip past.
    const metatype = wrapper.metatype as { prototype?: unknown } | null | undefined;
    const prototype = metatype?.prototype as Record<string, unknown> | undefined;
    if (!metatype || !prototype) continue;
    const prefixes = asList(reflector.get<unknown>(PATH_METADATA, metatype as Type));
    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler !== 'function') continue;
      const own = reflector.get<unknown>(PATH_METADATA, handler);
      // Nest routes on path metadata alone, so check the same way.
      if (own === undefined) continue;
      const versioned =
        reflector.get<unknown>(VERSION_METADATA, handler) !== undefined ||
        reflector.get<unknown>(VERSION_METADATA, metatype as Type) !== undefined;
      const methodValue = reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
      const permission = reflector.get<unknown>(PERMISSION_METADATA, handler);
      const httpCode = reflector.get<unknown>(HTTP_CODE_METADATA, handler);
      const isPost = methodValue === RequestMethod.POST;
      handlers.push({
        successStatus: typeof httpCode === 'number' ? httpCode : isPost ? 201 : 200,
        label: `${String(wrapper.name)}.${name}`,
        method: methodValue === undefined ? undefined : RequestMethod[methodValue],
        args: argumentKinds(metatype as Type, name),
        versioned,
        paths: prefixes.flatMap((prefix) => asList(own).map((path) => joinPath(prefix, path))),
        contract: reflector.get<Contract | undefined>(CONTRACT_METADATA, handler),
        public: reflector.get<unknown>(PUBLIC_METADATA, handler) === true,
        permission: typeof permission === 'string' ? permission : undefined,
      });
    }
  }
  return handlers.sort((a, b) => a.label.localeCompare(b.label));
}

/** `[ 'id', 'itemId' ]` for `/a/:id/b/:itemId`. */
export function pathParameters(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1] ?? '');
}
