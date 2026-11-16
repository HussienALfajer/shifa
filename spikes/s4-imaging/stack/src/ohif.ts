// OHIF v3 (0.3-S4b, criterion 10): the unmodified release image, configured only through its
// documented APP_CONFIG variable and, for the edge box, a mounted nginx template. Behind the
// gateway it serves the app; the gateway proxies its viewer route and static files with the
// session cookie and answers /dicomweb itself. On the clinic LAN a second OHIF proxies
// /dicomweb to the edge Orthanc (no gateway, no shaping).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runContainer } from './containers.ts';
import { IMAGES } from './images.ts';

/** The data source: DICOMweb on the page's own origin; pixel data by frames (no bulk route). */
export const APP_CONFIG = `window.config = {
  routerBasename: '/',
  showStudyList: false,
  showWarningMessageForCrossOrigin: false,
  showCPUFallbackMessage: false,
  investigationalUseDialog: { option: 'never' },
  maxNumberOfWebWorkers: 3,
  extensions: [],
  modes: [],
  defaultDataSourceName: 'dicomweb',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'Shifa imaging spike',
        name: 'shifa',
        wadoUriRoot: window.location.origin + '/dicomweb',
        qidoRoot: window.location.origin + '/dicomweb',
        wadoRoot: window.location.origin + '/dicomweb',
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        staticWado: false,
        singlepart: 'video',
        omitQuotationForMultipartRequest: true,
        bulkDataURI: { enabled: false },
      },
    },
  ],
};
`;

/** nginx template for the edge OHIF: the image's own server block plus /dicomweb → edge. */
const edgeTemplate = (authorization: string) => `server {
  gzip_static  always;
  gzip_proxied expired no-cache no-store private auth;
  gunzip       on;
  listen \${PORT} default_server;
  # Study reads only: the credential is the edge Orthanc's only user (security review M1).
  location ~ ^/dicomweb/studies(/|$) {
    limit_except GET { deny all; }
    rewrite ^/dicomweb/(.*)$ /dicom-web/$1 break;
    proxy_pass http://edge-orthanc:8042;
    proxy_set_header Authorization "${authorization}";
    proxy_read_timeout 600s;
  }
  location / {
    root   /usr/share/nginx/html;
    index  index.html index.htm;
    try_files $uri $uri/ \${PUBLIC_URL}index.html;
  }
}
`;

export async function startOhif(options: {
  name: string;
  runId: string;
  network: string;
  alias: string;
  /** For the edge OHIF: the edge Orthanc's `Basic …` credential, kept in a mounted template. */
  edge?: { runDir: string; authorization: string };
}): Promise<string> {
  const mounts: [string, string][] = [];
  if (options.edge) {
    const file = join(options.edge.runDir, 'ohif-edge.conf.template');
    await writeFile(file, edgeTemplate(options.edge.authorization));
    mounts.push([file, '/usr/src/default.conf.template']);
  }
  return runContainer({
    name: options.name,
    runId: options.runId,
    image: IMAGES.ohif,
    networks: [{ network: options.network, aliases: [options.alias] }],
    env: { PORT: '8080', APP_CONFIG },
    mounts,
  });
}
