// Spike auth (criterion 9, server half): an expired or foreign-key token applies nothing; the
// JWKS publishes the public key only.
import { generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { cmd, useServer } from './helpers.ts';

const server = useServer({ tokenTtlSeconds: 1 });

describe('auth', () => {
  it('rejects a request without a token', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/commands',
      body: { commands: [] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired token and applies nothing', async () => {
    const token = await server.login();
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    const issue = cmd.issue('dev-1', server.ids.A.practitioners[0]?.id ?? '', 1);
    expect((await server.post(token, [issue])).status).toBe(401);
    const fresh = await server.login();
    const res = await server.post(fresh, [issue]);
    // The first attempt stored nothing: the command now applies without a remap.
    expect(res.results[0]).toMatchObject({ status: 'applied' });
    expect(res.results[0]?.remap).toBeUndefined();
  });

  it('rejects a token signed by another key', async () => {
    const { privateKey } = await generateKeyPair('ES256');
    const forged = await new SignJWT({
      tenant_id: server.ids.A.tenantId,
      branch_id: server.ids.A.branchId,
      role: 'reception',
    })
      .setProtectedHeader({ alg: 'ES256', kid: 's1' })
      .setSubject(server.ids.A.receptionist.userId)
      .setAudience('shifa-s1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const issue = cmd.issue('dev-1', server.ids.A.practitioners[0]?.id ?? '', 2);
    expect((await server.post(forged, [issue])).status).toBe(401);
  });

  it('refuses an unknown user', async () => {
    const res = await server.app.inject({
      method: 'POST',
      url: '/auth/login',
      body: { username: 'nobody' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('publishes only the public key in the JWKS', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/.well-known/jwks.json' });
    const { keys } = res.json<{ keys: Record<string, unknown>[] }>();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', alg: 'ES256', kid: 's1' });
    expect(keys[0]).not.toHaveProperty('d');
  });

  it('refuses a patient token on the receptionist command endpoint', async () => {
    const login = await server.app.inject({
      method: 'POST',
      url: '/auth/patient-login',
      body: { patientId: server.ids.A.patients[0]?.id },
    });
    const { token } = login.json<{ token: string }>();
    const issue = cmd.issue('dev-1', server.ids.A.practitioners[0]?.id ?? '', 3);
    const res = await server.post(token, [issue]);
    expect(res.results[0]?.status).toBe('refused');
  });
});
