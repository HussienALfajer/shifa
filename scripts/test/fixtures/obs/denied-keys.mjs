// PLT-52 layer two: the keys the Collector must delete before storage (spec 0.2-09b criterion 6
// and apps/api/src/telemetry/scrub.ts), with one concrete example for every pattern. Shared by
// the Collector config test (simulated) and the Collector run test (the pinned image).

/** Every key here must be gone after the Collector's processors, whatever its value. */
export const DENIED_KEYS = [
  'http.request.body',
  'http.request.body.size',
  'http.response.body',
  'http.response.body.size',
  'url.query',
  'url.full',
  'url.path',
  'http.url',
  'http.target',
  'http.client_ip',
  'net.peer.ip',
  'net.sock.peer.addr',
  'http.request.header.cookie',
  'http.request.header.authorization',
  'http.request.header.x-forwarded-for',
  'http.request.header.x-patient-name',
  'http.response.header.set-cookie',
  'http.response.header.content-type',
  'client.address',
  'client.port',
  'network.peer.address',
  'db.query.text',
  'db.statement',
  'db.query.parameter.0',
  'db.query.parameter.patient_name',
  'exception.message',
  'enduser.id',
  'enduser.role',
];

/** Keys that must survive the Collector unchanged (the API's allowlist keeps them). */
export const KEPT_KEYS = {
  'http.route': '/patients/:id',
  'http.request.method': 'GET',
  'http.response.status_code': 500,
  'http.request.header.content-type': 'application/json',
  'user_agent.original': 'obs-fixture/1.0',
  'shifa.request_id': 'req-0000000001',
  'tenant.id': '00000000-0000-4000-8000-000000000001',
};

/** A synthetic value that must never be stored; one per denied key, so a leak names the key. */
export const deniedValue = (index) => `obs-denied-value-${String(index).padStart(2, '0')}`;

/** Synthetic personal data in an allowed key: the redaction processor masks it by value. */
export const BLOCKED_VALUES = {
  email: 'patient.fixture@example.com',
  bearer: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.c2lnbmF0dXJl',
};
