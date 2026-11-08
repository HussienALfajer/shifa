// A route contract: method, path, request schemas and response schemas per status. The API
// validates requests with it and generates OpenAPI from it; every schema in it must be named.
import type { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ContractRequest {
  /** Path parameters, one key per `:name` in `path`. */
  params?: z.ZodType;
  /** Query string; values arrive as strings, so use `z.coerce` for numbers and booleans. */
  query?: z.ZodType;
  /** JSON body. */
  body?: z.ZodType;
}

export interface Contract {
  /** camelCase, unique across the API; becomes the client method name. */
  operationId: string;
  method: HttpMethod;
  /** Nest-style path with `:name` parameters, e.g. `/patients/:id`. */
  path: string;
  summary?: string;
  request?: ContractRequest;
  /** Schema per status; `null` for a response without a body (204). */
  responses: Readonly<Record<number, z.ZodType | null>>;
}

/** Declares a contract; `const` keeps the literal types for the helpers below. */
export function defineContract<const C extends Contract>(contract: C): C {
  return contract;
}

type Part<C extends Contract, K extends keyof ContractRequest> =
  C['request'] extends Record<K, infer S> ? (S extends z.ZodType ? z.output<S> : never) : undefined;

/** What the handler receives from `@Param()` after validation. */
export type RequestParams<C extends Contract> = Part<C, 'params'>;
/** What the handler receives from `@Query()` after validation (coerced). */
export type RequestQuery<C extends Contract> = Part<C, 'query'>;
/** What the handler receives from `@Body()` after validation. */
export type RequestBody<C extends Contract> = Part<C, 'body'>;
/** The body the handler returns for `status`. */
export type ResponseBody<
  C extends Contract,
  S extends keyof C['responses'],
> = C['responses'][S] extends z.ZodType ? z.output<C['responses'][S]> : undefined;
