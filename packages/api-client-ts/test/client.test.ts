// Runtime behaviour of createApiClient: base URL and cookies on every request (no auth logic yet).
import { describe, expect, it } from 'vitest';
import { createApiClient } from '../src/index.ts';

function recordingFetch() {
  const requests: Request[] = [];
  const fetch = (input: Request) => {
    requests.push(input);
    return Promise.resolve(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { fetch, requests };
}

describe('createApiClient', () => {
  it('calls the API under the base URL and sends cookies', async () => {
    const { fetch, requests } = recordingFetch();
    const client = createApiClient({ baseUrl: 'https://api.example.test/v1', fetch });

    const { data } = await client.GET('/health/live');

    expect(data).toEqual({ status: 'ok' });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('https://api.example.test/v1/health/live');
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.credentials).toBe('include');
  });
});
