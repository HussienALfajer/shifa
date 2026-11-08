// How the guard learns who is calling. Better Auth (Phase A) will provide the real adapter;
// until then production authenticates nobody, so every protected route answers 401.
import { Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Principal } from './principal.ts';

export const AUTH_PORT = Symbol('AUTH_PORT');

export interface AuthPort {
  /** The caller's principal, or null when the request is not authenticated. */
  authenticate(request: FastifyRequest): Promise<Principal | null>;
}

@Injectable()
export class NoAuthAdapter implements AuthPort {
  authenticate(): Promise<Principal | null> {
    return Promise.resolve(null);
  }
}
