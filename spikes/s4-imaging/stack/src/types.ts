// Public shape of the imaging stack harness (startStack in stack.ts).

export type ProfileName = 'P1' | 'P2' | 'P3';

export interface StackOptions {
  /** Link profile applied once the link is up; 'none' leaves the link unshaped. */
  profile?: ProfileName | 'none';
  /**
   * Test access to the cloud side (an `ops` HAProxy on the internal network, ports published on
   * 127.0.0.1 only). Off for the network-boundary test. Default true.
   */
  ops?: boolean;
  /** Start the Playwright browser container on the clinic network. Default false. */
  browser?: boolean;
  /** Start the byte sink behind the link (link tests). Default false. */
  sink?: boolean;
}

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface TenantHandle {
  id: string;
  /** Orthanc REST base URL through the ops tunnel (host side). */
  orthancUrl: string;
  /** `Basic …` header for that Orthanc (the gateway's credential). */
  orthancAuth: string;
  bucket: string;
  s3: S3Credentials;
  database: string;
  container: string;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface LinkCounters {
  /** Bytes the link sent towards the cloud (clinic uplink). */
  upBytes: number;
  /** Bytes the link sent towards the clinic (clinic downlink). */
  downBytes: number;
}

export interface LinkEvent {
  at: string;
  event: 'profile' | 'cut-start' | 'cut-end' | 'reset';
  detail: string;
}

export interface Link {
  container: string;
  /** Applies a profile (or removes shaping with 'none'). */
  applyProfile(profile: ProfileName | 'none'): Promise<void>;
  /** 100 % loss in both directions for `seconds`, then the profile again. */
  cut(seconds: number): Promise<void>;
  /** Restarts HAProxy: every connection through the link dies. */
  reset(): Promise<void>;
  counters(): Promise<LinkCounters>;
  /**
   * P1 cuts: `cutSeconds` every `everySeconds`, first after `offsetSeconds`. Returns a stop
   * that waits for a cut in progress to end.
   */
  schedule(options: {
    everySeconds: number;
    cutSeconds: number;
    offsetSeconds: number;
  }): () => Promise<void>;
  events: LinkEvent[];
  /** Host-side URL of the byte sink through the link (when started with `sink`). */
  sinkUrl?: string;
}

export interface TokenClaims {
  sub?: string;
  tenant?: string;
  role?: 'viewer' | 'uploader' | 'edge';
  /** Seconds until expiry (negative for an expired token). Default 300. */
  ttlSeconds?: number;
}

export interface GatewayMetrics {
  /** Requests the gateway sent to an Orthanc. */
  upstream: number;
  /** Requests refused before any upstream call (route, method, token, role). */
  refused: number;
  /** Audit rows written. */
  audited: number;
}

export interface Stack {
  runId: string;
  /** The gateway through the link, from the host (clinic side). */
  gatewayUrl: string;
  /** The gateway through the link, as clinic containers see it. */
  clinicGatewayUrl: string;
  /** The two spike tenants (IMG-02: one Orthanc, database, bucket and key each). */
  tenants: { a: TenantHandle; b: TenantHandle };
  garage: {
    container: string;
    /** Garage S3 API through the ops tunnel. */
    s3Url: string;
    region: string;
    cli(...args: string[]): Promise<ExecResult>;
  };
  postgres: { container: string /** Superuser URL through the ops tunnel. */; url: string };
  gateway: { container: string; metrics(): Promise<GatewayMetrics> };
  link: Link;
  browser?: { container: string; wsEndpoint: string };
  networks: { clinic: string; cloud: string; orthanc: string };
  /** Signs a gateway token with this run's key. */
  token(claims: TokenClaims): Promise<string>;
  /** This run's token key (tests forge tokens with other keys and algorithms). */
  tokenKey: Uint8Array;
  /**
   * Every per-run secret, in each form it is written (passwords, Garage keys and tokens,
   * storage master keys as base64 and hex, the token key): log scans only.
   */
  secrets(): string[];
  /** Recreates a tenant's Orthanc with the current or a wrong storage master key. */
  restartOrthanc(tenant: string, options: { masterKey: 'current' | 'wrong' }): Promise<void>;
  /** Container logs (stdout and stderr). */
  logs(container: string): Promise<string>;
  /** Every container this run started. */
  containers(): string[];
  stop(): Promise<void>;
}
