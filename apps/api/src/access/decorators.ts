// Every route handler carries exactly one of these; the start-up check refuses anything else.
import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permissions.ts';

export const PUBLIC_METADATA = 'shifa:access:public';
export const PERMISSION_METADATA = 'shifa:access:permission';

/** Open to anonymous callers. Use only for probes and genuinely public pages. */
export const Public = (): MethodDecorator => SetMetadata(PUBLIC_METADATA, true);

/** Needs an authenticated principal holding `key` in its active tenant/branch. */
export const RequirePermission = (key: PermissionKey): MethodDecorator =>
  SetMetadata(PERMISSION_METADATA, key);
