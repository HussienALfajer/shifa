export { type ApiClient, type ApiClientOptions, createApiClient } from './client.ts';
export type { components, operations, paths } from './generated/schema.ts';

import type { components } from './generated/schema.ts';

/** Named schemas of the API, e.g. `Schemas['ErrorEnvelope']`. */
export type Schemas = components['schemas'];
