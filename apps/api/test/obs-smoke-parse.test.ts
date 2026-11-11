// Spec 0.2-09b criterion 10 (parsers): the smoke check reads Tempo, Loki, Prometheus and
// GlitchTip answers correctly, finds the request's trace id and detects the synthetic marker.
import { describe, expect, it } from 'vitest';
import {
  glitchtipEventFor,
  hasServerSpan,
  leaks,
  lokiLines,
  maskDsn,
  prometheusSeries,
} from '../scripts/obs-smoke-parse.ts';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
const OTHER = '00f067aa0ba902b700f067aa0ba902b7';
const MARKER = 'synthetic-patient-marker-7f3a91';
const base64 = (hex: string) => Buffer.from(hex, 'hex').toString('base64');

const tempoSpan = (traceId: string, name: string, kind: number | string) => ({
  traceId,
  spanId: 'AAAAAAAAAAE=',
  name,
  kind,
});

describe('hasServerSpan (Tempo)', () => {
  it('finds a server span by name in a v2 answer with a base64 trace id', () => {
    const body = {
      trace: {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  tempoSpan(base64(TRACE), 'pg.query', 'SPAN_KIND_CLIENT'),
                  tempoSpan(base64(TRACE), 'GET /_test/fail', 'SPAN_KIND_SERVER'),
                ],
              },
            ],
          },
        ],
      },
    };
    expect(hasServerSpan(body, TRACE, 'GET /_test/fail')).toBe(true);
  });

  it('reads v1 batches with hex ids and numeric kinds', () => {
    const body = {
      batches: [
        { instrumentationLibrarySpans: [{ spans: [tempoSpan(TRACE, 'GET /_test/fail', 2)] }] },
      ],
    };
    expect(hasServerSpan(body, TRACE, 'GET /_test/fail')).toBe(true);
  });

  it('rejects another trace, another name, a client span and junk', () => {
    const wrap = (span: object) => ({ resourceSpans: [{ scopeSpans: [{ spans: [span] }] }] });
    expect(
      hasServerSpan(wrap(tempoSpan(OTHER, 'GET /_test/fail', 2)), TRACE, 'GET /_test/fail'),
    ).toBe(false);
    expect(
      hasServerSpan(wrap(tempoSpan(TRACE, 'GET /health/ready', 2)), TRACE, 'GET /_test/fail'),
    ).toBe(false);
    expect(
      hasServerSpan(wrap(tempoSpan(TRACE, 'GET /_test/fail', 3)), TRACE, 'GET /_test/fail'),
    ).toBe(false);
    expect(hasServerSpan(null, TRACE, 'GET /_test/fail')).toBe(false);
    expect(hasServerSpan({ trace: 'x' }, TRACE, 'GET /_test/fail')).toBe(false);
  });
});

describe('lokiLines', () => {
  const answer = (streams: object[]) => ({
    status: 'success',
    data: { resultType: 'streams', result: streams },
  });

  it('returns the lines whose labels or structured metadata carry the trace id', () => {
    const body = answer([
      {
        stream: { service_name: 'shifa-api', trace_id: TRACE },
        values: [['1', 'request completed']],
      },
      {
        stream: { service_name: 'shifa-api' },
        values: [['2', 'internal error', { trace_id: TRACE }]],
      },
      { stream: { service_name: 'shifa-api', trace_id: OTHER }, values: [['3', 'other request']] },
    ]);
    expect(lokiLines(body, TRACE)).toEqual(['request completed', 'internal error']);
  });

  it('returns nothing for an empty or malformed answer', () => {
    expect(lokiLines(answer([]), TRACE)).toEqual([]);
    expect(lokiLines({ status: 'error' }, TRACE)).toEqual([]);
    expect(lokiLines(undefined, TRACE)).toEqual([]);
  });
});

describe('prometheusSeries', () => {
  it('counts the series of a successful instant query', () => {
    const body = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: [{ metric: { http_route: '/_test/fail' }, value: [1, '1'] }],
      },
    };
    expect(prometheusSeries(body)).toBe(1);
  });

  it('is 0 for no data, an error or junk', () => {
    expect(prometheusSeries({ status: 'success', data: { result: [] } })).toBe(0);
    expect(prometheusSeries({ status: 'error', error: 'bad query' })).toBe(0);
    expect(prometheusSeries('nope')).toBe(0);
  });
});

describe('glitchtipEventFor', () => {
  it('finds the event tagged with the trace id', () => {
    const events = [
      { eventID: 'aaa', tags: [{ key: 'trace_id', value: OTHER }] },
      {
        eventID: 'bbb',
        tags: [
          { key: 'route', value: '/_test/fail' },
          { key: 'trace_id', value: TRACE },
        ],
      },
    ];
    expect(glitchtipEventFor(events, TRACE)).toBe('bbb');
  });

  it('is undefined without a match or for junk', () => {
    expect(glitchtipEventFor([{ eventID: 'aaa', tags: [] }], TRACE)).toBeUndefined();
    expect(glitchtipEventFor({ detail: 'Not found' }, TRACE)).toBeUndefined();
  });
});

describe('leaks', () => {
  it('finds the marker anywhere in a payload, nested or in a string', () => {
    expect(leaks({ a: [{ b: `failure for ${MARKER}` }] }, MARKER)).toBe(true);
    expect(leaks([`x ${MARKER}`], MARKER)).toBe(true);
    expect(leaks({ message: 'Error', tags: [{ key: 'trace_id', value: TRACE }] }, MARKER)).toBe(
      false,
    );
  });
});

describe('maskDsn', () => {
  it('hides the public key and keeps host and project', () => {
    expect(maskDsn('http://0123456789abcdef@127.0.0.1:8000/1')).toBe(
      'http://****@127.0.0.1:8000/1',
    );
    expect(maskDsn('not a url')).toBe('****');
  });
});
