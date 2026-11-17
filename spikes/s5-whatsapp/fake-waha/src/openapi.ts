// The pinned image's OpenAPI document (fetched once at checkpoint A) and the record of where it
// came from. The fake registers only routes whose method and path are in the document.
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'openapi');
export const OPENAPI_DOCUMENT = join(dir, 'generated', 'waha-2026.10.1.openapi.json');
export const OPENAPI_SOURCE = join(dir, 'waha-openapi.source.json');

/** Fastify path (`:param`) → OpenAPI path (`{param}`). */
export const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, '{$1}');
