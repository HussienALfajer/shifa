// The edge box (0.3-S4b, criterion 9, IMG-17): an edge Orthanc on the clinic LAN (official
// image, SQLite index on its own volume, DICOM server, DICOMweb for LAN viewing, jobs saved
// across restarts) with one Transfers peer, `cloud` = the gateway through the link with an edge
// credential in the peer's HTTP header. Studies arrive by C-STORE from the dcmtk container.
// Only the configuration JSON is mounted (licence boundary, as for the cloud Orthanc).
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dcmtkImage } from '@shifa-spike/s4-generator';
import { execIn, hostPort, runContainer } from './containers.ts';
import { docker, sleep } from './docker.ts';
import { IMAGES } from './images.ts';
import { CONFIG_DIR, ORTHANC_ENV, waitOrthanc } from './orthanc.ts';
import type { Edge, EdgeJob } from './types.ts';

export const EDGE_AET = 'S4EDGE';

export function edgeConfig(
  httpPassword: string,
  edgeToken: string,
  transfers = { bucketKb: 512, threads: 2 },
): object {
  return {
    Name: 's4-edge',
    RemoteAccessAllowed: true,
    AuthenticationEnabled: true,
    RegisteredUsers: { gateway: httpPassword },
    DicomServerEnabled: true,
    DicomAet: EDGE_AET,
    DicomPort: 4242,
    StorageCompression: false,
    SaveJobs: true,
    JobsHistorySize: 100,
    // Room for the cloud to commit a large push (review N5), yet a request opened during a
    // line drop fails within minutes so the job is retried: 1800 s left a job hanging 30 min.
    // The 1 GB commit time is measured in 0.3-S4c.
    HttpTimeout: 300,
    OrthancPeers: {
      cloud: {
        Url: 'http://link:8080/',
        HttpHeaders: { Authorization: `Bearer ${edgeToken}` },
      },
    },
    // 512 KB buckets, two at a time: on P1 (1 Mbit/s up) a 4 MB bucket, four in parallel, takes
    // about two minutes and never arrives whole between line drops (0.3-S4b finding).
    // The bench (0.3-S4c) compares other bucket sizes through `transfers`.
    Transfers: {
      MaxHttpRetries: 3,
      PeerConnectivityTimeout: 120,
      BucketSize: transfers.bucketKb,
      Threads: transfers.threads,
    },
    DicomWeb: { Enable: true, Root: '/dicom-web/', EnableWado: false },
  };
}

export async function startEdge(options: {
  name: (role: string) => string;
  runId: string;
  runDir: string;
  clinicNetwork: string;
  httpPassword: string;
  edgeToken: string;
  clinicViewerUrl: string;
  transfers?: { bucketKb: number; threads: number };
}): Promise<Edge> {
  const { name, runId, clinicNetwork, httpPassword } = options;
  const config = join(options.runDir, 'orthanc-edge.json');
  await writeFile(
    config,
    JSON.stringify(edgeConfig(httpPassword, options.edgeToken, options.transfers), null, 2),
  );
  const container = await runContainer({
    name: name('edge'),
    runId,
    image: IMAGES.orthanc,
    networks: [{ network: clinicNetwork, aliases: ['edge-orthanc'] }],
    env: { ...ORTHANC_ENV },
    mounts: [[config, `${CONFIG_DIR}/s4.json`]],
    publish: [8042],
  });
  await waitOrthanc(container, httpPassword);
  // A restart publishes the port again on a new random host port: re-read it then.
  let base = `http://${await hostPort(container, 8042)}`;
  const auth = `Basic ${Buffer.from(`gateway:${httpPassword}`).toString('base64')}`;
  const rest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { authorization: auth, ...(init.headers as Record<string, string>) },
    });
    if (!res.ok) throw new Error(`edge ${path.split('/')[1] ?? ''}: ${String(res.status)}`);
    return (await res.json()) as T;
  };
  const dcmtk = await dcmtkImage();
  /** Push jobs this harness started: job id → study, to push again a job lost on restart. */
  const pushes = new Map<string, string>();
  const studyId = async (studyUid: string) => {
    const found = await rest<{ ID: string; Type: string }[]>('/tools/lookup', {
      method: 'POST',
      body: studyUid,
    });
    const study = found.find((r) => r.Type === 'Study');
    if (!study) throw new Error('study not on the edge');
    return study.ID;
  };

  const edge: Edge = {
    container,
    clinicViewerUrl: options.clinicViewerUrl,
    storescu: async (dir, paths) => {
      for (let i = 0; i < paths.length; i += 200) {
        const files = paths.slice(i, i + 200).map((p) => `/data/${p}`);
        await docker(
          [
            'run',
            '--rm',
            '--network',
            clinicNetwork,
            '--mount',
            `type=bind,source=${dir},target=/data,readonly`,
            dcmtk,
            'storescu',
            '-aec',
            EDGE_AET,
            'edge-orthanc',
            '4242',
            ...files,
          ],
          { timeoutMs: 1_800_000 },
        );
      }
    },
    files: async (studyUid) => {
      const study = await studyId(studyUid);
      const instances = await rest<{ ID: string; MainDicomTags: { SOPInstanceUID: string } }[]>(
        `/studies/${study}/instances`,
      );
      const hashes = new Map<string, string>();
      for (const instance of instances) {
        const res = await fetch(`${base}/instances/${instance.ID}/file`, {
          headers: { authorization: auth },
        });
        const bytes = new Uint8Array(await res.arrayBuffer());
        hashes.set(
          instance.MainDicomTags.SOPInstanceUID,
          createHash('sha256').update(bytes).digest('hex'),
        );
      }
      return hashes;
    },
    push: async (studyUid) => {
      const study = { ID: await studyId(studyUid) };
      const job = await rest<{ ID: string }>('/transfers/send', {
        method: 'POST',
        body: JSON.stringify({
          Resources: [{ Level: 'Study', ID: study.ID }],
          Compression: 'gzip',
          Peer: 'cloud',
        }),
      });
      pushes.set(job.ID, studyUid);
      return job.ID;
    },
    job: async (id) => {
      const res = await fetch(`${base}/jobs/${id}`, { headers: { authorization: auth } });
      // Orthanc 26.11 with Transfers 1.7 does not reload a push job after a restart, although
      // SaveJobs is on (0.3-S4b finding): report it as failed, so the caller resubmits.
      if (res.status === 404 && pushes.has(id)) {
        await res.arrayBuffer();
        return { ID: id, State: 'Failure', Progress: 0, ErrorDescription: 'lost on restart' };
      }
      if (!res.ok) throw new Error(`edge jobs: ${String(res.status)}`);
      return (await res.json()) as EdgeJob;
    },
    waitJob: async (id, timeoutMs) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const job = await edge.job(id);
        if (job.State === 'Success' || job.State === 'Failure' || Date.now() > deadline) {
          return job;
        }
        await sleep(1000);
      }
    },
    resubmit: async (id) => {
      const lost = await fetch(`${base}/jobs/${id}`, { headers: { authorization: auth } });
      await lost.arrayBuffer();
      const studyUid = pushes.get(id);
      // A job lost on restart is pushed again as a new job: the whole study goes again, and
      // the cloud keeps one copy per SOP Instance UID.
      if (lost.status === 404 && studyUid) return edge.push(studyUid);
      await rest<object>(`/jobs/${id}/resubmit`, { method: 'POST', body: '' });
      return id;
    },
    restart: async () => {
      await docker(['restart', container]);
      await waitOrthanc(container, httpPassword);
      base = `http://${await hostPort(container, 8042)}`;
    },
  };
  // The dcmtk tools reach the edge's DICOM port by name: wait until it accepts associations.
  await waitEcho(clinicNetwork, dcmtk);
  return edge;
}

async function waitEcho(network: string, image: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const out = await docker(
      [
        'run',
        '--rm',
        '--network',
        network,
        image,
        'echoscu',
        '-aec',
        EDGE_AET,
        'edge-orthanc',
        '4242',
      ],
      { check: false },
    );
    if (out.code === 0) return;
    await sleep(1000);
  }
  throw new Error('edge DICOM server not reachable');
}

export { execIn };
