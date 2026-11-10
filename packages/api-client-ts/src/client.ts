// Typed fetch client over the generated OpenAPI types (ADR-0013). Session cookies go with every
// request (`credentials: 'include'`); auth, retries and error mapping come in later slices.
import createClient, { type Client, type ClientOptions } from 'openapi-fetch';
import type { paths } from './generated/schema.ts';

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** API origin and prefix, e.g. `https://api.example.test`; no trailing slash needed. */
  baseUrl: string;
  /** Custom fetch (tests, server-side rendering); defaults to the global fetch. */
  fetch?: NonNullable<ClientOptions['fetch']>;
}

export function createApiClient({ baseUrl, fetch }: ApiClientOptions): ApiClient {
  return createClient<paths>({
    baseUrl,
    credentials: 'include',
    ...(fetch ? { fetch } : {}),
  });
}
