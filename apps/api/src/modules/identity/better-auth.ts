// The Better Auth instance (ADR-0016 as amended by A-01-02): a library called through `auth.api.*`
// only. Its catch-all handler is never mounted, so every identity route is a Nest controller
// under the global guard (A-01a criterion 16). Gate results: docs/slices/A-01-02-*.md.
import { Logger } from '@nestjs/common';
import { type AuthDb, account, session, twoFactor, user, verification } from '@shifa/db';
import { betterAuth } from 'better-auth';
import { phoneNumber, twoFactor as twoFactorPlugin } from 'better-auth/plugins';
import type { Clock } from '../../platform/clock.ts';
import { scopedAuthAdapter } from './auth-adapter.ts';
import { SESSION_ABSOLUTE_MS, SESSION_COOKIE } from './session-cookie.ts';

export interface ShifaAuthOptions {
  authDb: AuthDb;
  secret: string;
  clock: Clock;
  /** The clinic and branch a new session starts in. */
  activeAtSignIn(userId: string): Promise<{ tenantId: string | null; branchId: string | null }>;
}

/** Better Auth's own log lines carry no values we need; keep the level, drop the arguments. */
function quietLogger() {
  const nest = new Logger('BetterAuth');
  return {
    level: 'warn' as const,
    log: (level: 'debug' | 'info' | 'success' | 'warn' | 'error', message: string) => {
      if (level === 'error') nest.error(message);
      else if (level === 'warn') nest.warn(message);
    },
  };
}

export function createShifaAuth(options: ShifaAuthOptions) {
  const { authDb, secret, clock } = options;
  return betterAuth({
    appName: 'Shifa',
    secret,
    // Never contacted: no handler is mounted; Better Auth needs a base URL for its cookie logic.
    baseURL: 'https://shifa.invalid',
    telemetry: { enabled: false },
    // The throttle service counts failures per phone and per IP (criterion 7).
    rateLimit: { enabled: false },
    logger: quietLogger(),
    database: scopedAuthAdapter(authDb, { user, session, account, verification, twoFactor }),
    emailAndPassword: { enabled: false, minPasswordLength: 10, maxPasswordLength: 128 },
    advanced: {
      database: { generateId: 'uuid' },
      // The prefix is part of the name: Better Auth must not add `__Secure-` in front of it.
      useSecureCookies: false,
      cookies: { session_token: { name: SESSION_COOKIE, attributes: { secure: true } } },
      // No IP stored with sessions: the list shows device, browser and last activity only.
      ipAddress: { disableIpTracking: true },
    },
    session: {
      expiresIn: SESSION_ABSOLUTE_MS / 1000,
      // The absolute limit never moves; idle is checked by SessionsService on every request.
      disableSessionRefresh: true,
      additionalFields: {
        activeTenantId: { type: 'string', required: false, input: false },
        activeBranchId: { type: 'string', required: false, input: false },
        lastActiveAt: { type: 'date', required: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          // Times from the injected clock (tests move it); the clinic from the memberships.
          before: async (data) => {
            const now = clock.now();
            const active = await options.activeAtSignIn(data.userId);
            return {
              data: {
                ...data,
                createdAt: now,
                updatedAt: now,
                lastActiveAt: now,
                expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
                activeTenantId: active.tenantId,
                activeBranchId: active.branchId,
              },
            };
          },
        },
      },
    },
    plugins: [phoneNumber(), twoFactorPlugin({ issuer: 'Shifa' })],
  });
}

export type ShifaAuth = ReturnType<typeof createShifaAuth>;
