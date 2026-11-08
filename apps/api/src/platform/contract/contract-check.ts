// Start-up check: every route handler carries @Contract, the contract names the method and path
// Nest registered, every schema in it is named, path parameters are declared, and operationIds
// are unique camelCase. Runs on application bootstrap, like the access check.
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { type Contract, schemaId } from '@shifa/contracts';
import type { z } from 'zod';
import { pathParameters, type RouteHandler, routeHandlers } from './routes.ts';

export class ContractAnnotationError extends Error {
  override name = 'ContractAnnotationError';
}

const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/;
const PARTS = ['params', 'query', 'body'] as const;

function objectKeys(schema: z.ZodType | undefined): string[] | undefined {
  const shape = (schema as { shape?: unknown } | undefined)?.shape;
  return shape && typeof shape === 'object' ? Object.keys(shape).sort() : undefined;
}

function contractProblems(route: RouteHandler, contract: Contract): string[] {
  const problems: string[] = [];
  const at = (text: string) => `  ${route.label}: ${text}`;
  const path = route.paths.length === 1 ? route.paths[0] : undefined;
  if (path === undefined) {
    problems.push(at(`one path per handler (has ${route.paths.join(', ')})`));
  } else if (contract.method !== route.method || contract.path !== path) {
    problems.push(
      at(`contract says ${contract.method} ${contract.path}, route is ${route.method} ${path}`),
    );
  }
  if (!CAMEL_CASE.test(contract.operationId)) {
    problems.push(at(`operationId ${contract.operationId} is not camelCase`));
  }
  for (const part of PARTS) {
    const schema = contract.request?.[part];
    if (schema && schemaId(schema) === undefined) problems.push(at(`request ${part} has no id`));
  }
  const statuses = Object.keys(contract.responses);
  if (!(route.successStatus in contract.responses)) {
    problems.push(
      at(`answers ${String(route.successStatus)} but the contract has no such response`),
    );
  }
  for (const status of statuses) {
    const schema = contract.responses[Number(status)];
    if (schema && schemaId(schema) === undefined) problems.push(at(`response ${status} has no id`));
  }
  const declared = pathParameters(contract.path).sort();
  const params = contract.request?.params;
  const keys = params ? objectKeys(params) : [];
  if (keys === undefined) {
    problems.push(at('request params must be a z.object'));
  } else if (keys.join(',') !== declared.join(',')) {
    problems.push(
      at(`params schema keys [${keys.join(', ')}] differ from path [${declared.join(', ')}]`),
    );
  }
  return problems;
}

/** One line per problem, over all handlers of the app. */
export function routeContractProblems(routes: readonly RouteHandler[]): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string[]>();
  for (const route of routes) {
    if (!route.contract) {
      problems.push(`  ${route.label}: no @Contract`);
      continue;
    }
    problems.push(...contractProblems(route, route.contract));
    const id = route.contract.operationId;
    owners.set(id, [...(owners.get(id) ?? []), route.label]);
  }
  for (const [id, labels] of owners) {
    if (labels.length > 1) problems.push(`  operationId ${id} is used by ${labels.join(', ')}`);
  }
  return problems.sort();
}

@Injectable()
export class ContractCheck implements OnApplicationBootstrap {
  constructor(
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
    @Inject(MetadataScanner) private readonly scanner: MetadataScanner,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const problems = routeContractProblems(this.routes());
    if (problems.length > 0) {
      throw new ContractAnnotationError(
        `Every route handler needs a matching @Contract with named schemas:\n${problems.join('\n')}`,
      );
    }
  }

  routes(): RouteHandler[] {
    return routeHandlers({
      discovery: this.discovery,
      scanner: this.scanner,
      reflector: this.reflector,
    });
  }
}
