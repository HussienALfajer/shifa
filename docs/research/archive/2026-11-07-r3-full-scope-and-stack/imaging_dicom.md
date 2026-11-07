# Medical Imaging / DICOM Infrastructure for a Multi-Tenant Dental + Orthopedic Clinic SaaS (Syria: Aleppo/Azaz) — research notes, as of 2026-11-07

Context assumed throughout: closed-source multi-tenant SaaS, small team, weak links (fixed broadband ~3 Mbps median, mobile ~25 Mbps — figures given in the brief, not re-verified), frequent power cuts, owner wants a "professional" DICOM viewer in release 1. Licensing statements are not legal advice.

## 1. Web DICOM viewers (OHIF v3.x, Cornerstone3D, alternatives): versions, features, licenses, React embedding, Arabic/RTL, mobile

### Takeaway
OHIF (MIT) on Cornerstone3D (MIT) is the only mature, permissively licensed, full-featured web viewer; current stable is v3.13.0 (July 2026), with 3.14 in beta. Its weak points for this project are Arabic/RTL (no documented RTL support, Arabic not shipped) and phone/tablet ergonomics (community-reported problems), and it is a standalone app (usually embedded via iframe/route) rather than a drop-in React component. GPL/AGPL viewers (dwv, Stone, Orthanc Web Viewer) are poor fits for closed code; MedDream is the commercial, regulatory-cleared alternative.

### Cited Findings
**OHIF versions and features**
- OHIF release list: v3.13.0 (latest, July 2026: smart scrollbar, new study list, appearance themes / "UI-next", Cornerstone 5.0); v3.12.0 (Feb 2026: contour segmentation tools, combine/modify multiple segments, unified panel); v3.11.0 (Aug 2025: multimodality fusion, ultrasound mode, RT workflows); v3.10.0 (Apr 2025: AI-powered segmentation tools). — [OHIF release notes](https://ohif.org/release-notes)
- OHIF docs site currently labels "3.14 Beta (Latest)". — [OHIF i18n docs](https://docs.ohif.org/platform/internationalization)
- v3.11 added: rebuilt viewport dialog for fusion (PET/CT, RT Dose overlays with opacity/blending), lung-ultrasound annotation mode, DICOM Label Map support, RT Structure Set contours projected onto planes other than the acquisition plane, SCOORD3D import/export for 3D annotations. — [OHIF v3.11 release notes](https://ohif.org/release-notes/3p11/)
- License: "OHIF is open source software released under the MIT license." — [OHIF release notes](https://ohif.org/release-notes); Cornerstone3D repo is MIT. — [cornerstonejs/cornerstone3D GitHub](https://github.com/cornerstonejs/cornerstone3D/)
- Cornerstone3D ships a `CobbAngleTool` class in its tools package (API docs). — [Cornerstone3D CobbAngleTool API](https://cornerstonejs.org/docs/api/tools/classes/CobbAngleTool)
- OHIF has a `CalibrationLineTool` (extends LengthTool) that calls `calibrateImageSpacing` with a user-entered real length; when PixelSpacing is missing, measurements display in pixels until calibrated. — [OHIF CalibrationLineTool source coverage](https://docs.ohif.org/coverage/extensions/cornerstone/src/tools/calibrationlinetool.ts); [OHIF community thread](https://community.ohif.org/t/change-units-for-length-tool/1420)
- Cornerstone's `getCalibratedUnits` picks mm when spacing is known, otherwise pixel units; it also handles an "uncalibrated" type. — [Cornerstone getCalibratedUnits](https://www.cornerstonejs.org/coverage/tools/src/utilities/getcalibratedunits.ts)
- Cornerstone3D supports streaming image volumes (volume loading for MPR/3D) and custom image/volume/metadata loaders, DICOMweb out of the box. — [Cornerstone streaming volume docs](https://cornerstonejs.org/docs/concepts/streaming-image-volume/streaming); [cornerstone3D GitHub](https://github.com/cornerstonejs/cornerstone3D/)

**Embedding in React**
- A third-party project (reflex-ohif-viewer) reports `@ohif/app` on npm is a prebuilt static site, OHIF exposes no importable React component, so embedding typically means self-hosting a build in an iframe; it says Cornerstone3D is published as real npm libraries that can be wrapped as a native React component (two-way state binding). It also claims official Cornerstone3D React templates lag "roughly three majors". Single-author claims, unverified. — [reflex-ohif-viewer on PyPI](https://pypi.org/project/reflex-ohif-viewer/0.2.0/)
- OHIF docs include an iframe-embedding guide; community suggests webview wrapping for mobile apps. — [OHIF community: OHIF on Mobile APP](https://community.ohif.org/t/ohif-on-mobile-app/478)

**Arabic / RTL**
- OHIF i18n uses i18next (`@ohif/i18n`), language switch via `?lng=` URL param, translations managed on Locize; languages can be added by PR or locally via `addLocales()` / `addResourceBundle`. Arabic appears only in the translator sign-up list; the page does not mention RTL or `dir` handling. — [OHIF i18n docs](https://docs.ohif.org/platform/internationalization)

**Mobile / tablet**
- OHIF's 3.9 iteration plan included responsive design for tablets/mobile (issue #4099); completion not confirmed. Community reports: double-tap to enlarge viewport unreliable on mobile, header and toolbar overlapping, zoom unavailable; maintainers suggested single-column layouts / custom hanging protocols for mobile. — [OHIF GitHub issue 4094](https://github.com/OHIF/Viewers/issues/4094); [OHIF community: double tap on mobile](https://community.ohif.org/t/when-i-add-double-tab-event-at-viewer-on-mobile-phone-i-will-get-a-larger-of-errors/763); [OHIF community: header/zoom issue in mobile viewer](https://community.ohif.org/t/header-display-and-zoom-issue-in-mobile-viewer/2856)

**Alternatives and licenses**
- dwv (ivmartel): GPL-3.0; "not certified for diagnostic use"; npm 0.34.x. — [dwv README](https://github.com/ivmartel/dwv/blob/master/readme.md); [dwv on npm](https://npmjs.com/package/dwv)
- Weasis: since 3.7.0 dual-licensed EPL-2.0 OR Apache-2.0 (desktop Java viewer). — [Weasis GitHub](https://github.com/nroduit/Weasis); [Weasis 3rd-party licenses](https://www.github.com/nroduit/Weasis/blob/master/3rd-party-licenses.md)
- VolView (Kitware): Apache-2.0 per VTK forum and SPDX headers in Orthanc's VolView patch; older VolView 3.4 desktop was BSD-style and is discontinued. An official Orthanc VolView plugin exists. — [VTK discourse](https://discourse.vtk.org/t/how-can-i-obtain-a-license-for-the-desktop-software-volview-3-4-win64-x86-exe/12573); [orthanc-volview patch license](https://orthanc.uclouvain.be/hg/orthanc-volview/file/ec47d2182ac6/VolView/VolView-4.1.1.patch.license); [Orthanc plugins list](https://orthanc.uclouvain.be/book/plugins.html)
- Stone Web Viewer, Orthanc Web Viewer, Osimis Web Viewer: AGPL; a derived viewer used in a proprietary cloud service is "Restricted" (must become AGPL). — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- MedDream (Softneta): commercial HTML5 zero-footprint viewer; FDA-cleared for diagnostic use (incl. mammography), CE Class IIb; white-label/OEM program (own logo, login screen, colour theme); license per server/instance (Docker needs unique serial + license file per instance); 45-day demo; prices only on request. — [MedDream FAQ](https://meddream.com/faq/meddream-dicom-viewer/); [MedDream OEM page](https://meddream.com/solutions/pacs-viewer-for-medical-software-vendors-oems/); [MedDream Docker Hub](https://hub.docker.com/r/meddream/dicom-viewer); [Capterra MedDream](https://www.capterra.com/p/195589/MedDream/)
- Official Orthanc viewer plugins: Stone Web viewer, OHIF plugin, VolView plugin, Orthanc Web Viewer, Osimis (deprecated). — [Orthanc plugins list](https://orthanc.uclouvain.be/book/plugins.html)
- OHIF plugin for Orthanc is official (UCLouvain ICTEAM) and needs no reverse proxy; GDCM plugin recommended if images are JPEG 2000-compressed. — [orthanc-ohif README](https://orthanc.uclouvain.be/hg/orthanc-ohif/raw-file/default/README)

### Inferences
- For a closed SaaS, OHIF + Cornerstone3D is the licensing-safe default (MIT: keep copyright notices, no source disclosure). A forked OHIF is the fastest route to "professional" features (MPR, measurements incl. Cobb, segmentation, hanging protocols).
- Practical split: (a) a forked, self-hosted OHIF build served under the SaaS domain (route or iframe) for the full diagnostic viewer, with tenant-scoped short-lived tokens passed in; (b) a lightweight custom React component on Cornerstone3D for in-chart thumbnails, dental mounts (FMX) and side-by-side ortho comparisons, which OHIF does not do natively for dentistry.
- RTL: keep the viewer canvas/toolbars LTR (as most PACS do), translate labels into Arabic via a custom i18next bundle, and mirror only the surrounding SaaS chrome. This is a design judgment; no source documents OHIF RTL behaviour.
- Mobile: treat phones as "review/share" devices (single viewport, simplified toolbar); target tablets/laptops for diagnostic use. Budget testing time, because the community reports touch problems.
- Avoid dwv (GPL-3.0: shipping its JS to browsers combined with proprietary code would create GPL obligations) and avoid modifying Stone/Orthanc viewers (AGPL). Weasis (Apache-2.0 option) is a legitimate free desktop fallback for heavy CBCT/CT review on clinic PCs.
- MedDream is the option if regulatory clearance of the viewer matters to buyers or regulators; the cost is unknown and the license is per instance.

### Gaps
- No primary OHIF doc found listing the full v3.13 tool set (MPR/3D volume rendering presets, ellipse ROI, hanging protocols); feature presence is inferred from release notes and Cornerstone3D API, not from a single feature matrix.
- Whether OHIF 3.13/3.14 ships an Arabic translation or any RTL support: not found.
- "Weasis web" or a Weasis browser version: not researched or confirmed; Weasis is treated here as desktop only.
- OHIF's own regulatory status: not found; generally positioned as not cleared (unverified here).

## 2. DICOM archives (Orthanc, dcm4chee, cloud DICOM services) and multi-tenant isolation

### Takeaway
Orthanc (core GPLv3+, key plugins AGPLv3) with PostgreSQL index + S3-compatible object storage is the best-fitting archive for a small team; it has labels (since 1.12.0), a labels-aware advanced authorization plugin (v0.12.x, 2026) that filters `tools/find` and DICOMweb QIDO, and a sample multitenant DICOM plugin. Tenant isolation should not rely on Orthanc alone: put Orthanc behind your own API gateway / DICOMweb proxy, with route whitelisting and per-tenant labels, and use the authorization plugin as a second layer. Managed cloud DICOM (AWS HealthImaging, Google, Azure) is cheap to store but availability and payment from Syria remain uncertain.

### Cited Findings
**Orthanc licensing by component**
- Orthanc core GPLv3+ since 2012; "the plugins that provide scalability-related or cloud-related features" are AGPLv3+; PostgreSQL plugin AGPLv3+; Web viewer, Osimis viewer, Stone Web Viewer AGPL. — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- DICOMweb plugin: AGPL (upstream README; Debian copyright lists plugin as AGPL-3). — [orthanc-dicomweb README](https://orthanc.uclouvain.be/hg/orthanc-dicomweb/file/4f543f8b9b5d/README); [Debian copyright](https://sources.debian.org/src/orthanc-dicomweb/0.3%2Bdfsg-1/debian/copyright)
- Cloud object-storage plugins (AWS S3 / Azure Blob / Google Cloud Storage): GitHub mirror metadata says AGPL-3.0 (not verified against COPYING). The Orthanc Book says the project "usually doesn't freely update them or fix them unless the requester purchases a support contract," for example from Orthanc Team. — [science.ecosyste.ms mirror listing](https://science.ecosyste.ms/projects/22769); [Orthanc object storage page](https://orthanc.uclouvain.be/book/plugins/object-storage.html)
- Advanced authorization plugin: AGPL. — [orthanc-authorization README](https://orthanc.uclouvain.be/hg/orthanc-authorization/file/0ddba2f3aec6/README)
- dcm4chee-arc-light: README names Mozilla Public License 1.1; the underlying dcm4che library is documented as MPL 1.1 / GPL 2.0 / LGPL 2.1 tri-license (secondary sources; check the repo LICENSE). Releases up to at least 5.35.0 are listed. — [dcm4chee-arc-light mirror](https://gitee.com/ljgeng/dcm4chee-arc-light); [PMC open-source PACS license table](https://pmc.ncbi.nlm.nih.gov/articles/PMC10584756/table/Tab3); [newreleases 5.35.0](https://newreleases.io/project/github/dcm4che/dcm4chee-arc-light/release/5.35.0)

**Orthanc storage features**
- Object storage plugins support AWS S3, Azure Blob, Google Cloud Storage and S3-compatible endpoints (MinIO, Ceph; Scaleway shown as custom endpoint). Hybrid mode since plugin 2.1.0 (`WriteToFileSystem` / `WriteToObjectStorage`, `/move-storage` to migrate). Optional client-side AES-256-GCM encryption with per-file DEK wrapped by a master key, key rotation; it cannot be enabled after unencrypted files exist. AWS plugin included in Windows installers from 24.6.3; versions mentioned up to 2.5.4. — [Orthanc object storage](https://orthanc.uclouvain.be/book/plugins/object-storage.html)
- Official plugin catalogue includes: PostgreSQL, MySQL/MariaDB, ODBC, Cloud Object Storage, Google Cloud Platform, DICOMweb, Worklists, STL, Advanced Storage, Advanced authorization, Delayed deletion, GDCM, Housekeeper, Folder Indexer, Sample multitenant DICOM server, Transfers accelerator, Pixels Masker, Python, Java; AWS S3 storage also listed under contributed plugins. — [Orthanc plugins list](https://orthanc.uclouvain.be/book/plugins.html)

**Multi-tenancy primitives in Orthanc**
- Sample Multitenant DICOM Server plugin (official since Orthanc 1.12.0): starts extra DICOM servers (own AET + port), each bound to a set of labels; C-FIND/C-MOVE return only resources carrying those labels; C-STORE on that AET applies the labels (`LabelsStoreLevels`, default study/series/instance); `LabelsConstraint` All/Any/None mirrors `/tools/find`. — [Orthanc multitenant DICOM plugin](https://orthanc.uclouvain.be/book/plugins/multitenant-dicom.html)
- Authorization plugin: for each REST request it queries an external web service; tokens via header or GET arg; routes `/tokens/validate`, `/tokens/{type}`, `/tokens/decode`, `/user/get-profile`; profile returns `authorized-labels` and `permissions`; "If a list of `authorized-labels` has been returned, the authorization plugin will add a label filter to each call to `tools/find`"; per-resource checks verify labels; "Unrecognized URIs (such as those introduced by other non official plugins) will be handled as a `system` call." — [Orthanc authorization plugin](https://orthanc.uclouvain.be/book/plugins/authorization.html)
- Authorization plugin release history (NEWS): v0.4.0 (2022-11-10) QIDO-RS query arguments; v0.5.0 (2023-03-17) user-permission model + security fix (remote DICOMweb browsing without auth); v0.6.0 (2023-09-18) label-based permissions from user profile; v0.7.1 (2024-03-25) `tools/find` respects authorized labels; v0.7.2 fix for `/dicom-web/studies/../series`; v0.9.0 (2025-02-27) filters unauthorized labels out of "Labels" fields, VolView config; v0.9.2 (2025-04-29) empty list instead of 403 for some `/dicom-web/studies` calls, thumbnails; v0.9.4 (2025-07-14) security fix on token-permission cache lifetime; v0.10.0 (2025-08-12) `ExtraPermissions`, audit-logs permission; v0.11.4 (2026-07-23) new default permissions for DICOMweb QIDO/retrieve routes; v0.12.0 (2026-08-28) inbox-links; v0.12.1 (2026-11-05) view-jobs permissions. — [orthanc-authorization NEWS](https://orthanc.uclouvain.be/hg/orthanc-authorization/file/default/NEWS). Note: a search snapshot showed v0.11.4 still marked "pending", so release state of the newest entries is not fully confirmed. — [NEWS raw](https://orthanc.uclouvain.be/hg/orthanc-authorization/raw-file/default/NEWS)
- orthanc-auth-service (Orthanc Team, Docker image): web service next to Orthanc that issues JWTs for study sharing checked by the authorization plugin; optional Keycloak integration (`ENABLE_KEYCLOAK`), role-to-permission mapping file, `PUBLIC_OHIF_ROOT` for OHIF share links. — [orthanc-auth-service on Docker Hub](https://hub.docker.com/r/orthancteam/orthanc-auth-service)

**Managed cloud DICOM and Syria**
- AWS HealthImaging (US East example): Frequent Access $0.105/GB-month, Archive Instant Access $0.006/GB-month; no retrieval charges; free import; 5 MB billing minimum per image set; metadata indexing billed (10 GB included); API operations and egress billed. — [AWS HealthImaging pricing](https://aws.amazon.com/healthimaging/pricing); [HealthImaging cost optimization](https://docs.aws.amazon.com/healthimaging/latest/devguide/cost-optimization.html)
- Managed DICOM stores exist as AWS HealthImaging, Google Cloud Healthcare API, Azure Health Data Services DICOM service. — [Mindbowser cloud dental imaging](https://www.mindbowser.com/cloud-dental-imaging-software/)
- US terminated the Syria sanctions program effective 2025-07-01; residual export controls still restrict some software / cloud services to Syria, and screening remains needed. — [Morrison Foerster, Sept 2025](https://www.mofo.com/resources/insights/250929-u-s-relaxes-export-controls-on-syria); [Mondaq: software/cloud concerns remain](https://webiis08.mondaq.com/unitedstates/export-controls-trade-investment-sanctions/1690376/syria-sanctions-subside-software-cloud-service-and-other-export-concerns-remain)
- Google services started returning to Syria (communications minister, Jan 2026). — [Anadolu Agency](https://www.aa.com.tr/en/middle-east/google-services-resume-in-syria-after-years-long-ban-under-assad-regime/3802701)
- AWS: only an unanswered re:Post question about Syria availability after the sanctions relief. — [AWS re:Post](https://repost.aws/questions/QUzfl4e_xnQ32Oqf1x8AKqvw/access-aws-console-and-service-in-syria-after-sanction-being-lifted-recently)

### Inferences
- **Recommended archive pattern for a small team:** one (or a few sharded) Orthanc deployments using the official Docker images, PostgreSQL index, S3-compatible bucket (with plugin encryption on from day 1), Orthanc never exposed publicly. All client traffic (QIDO/WADO/STOW, uploads, viewer) goes through the SaaS's own **DICOMweb gateway**, which (1) authenticates the user and resolves the tenant, (2) whitelists only the needed routes (`/dicom-web/studies…`, specific REST routes), (3) for QIDO injects/validates the tenant label filter, (4) for WADO/series/instance calls checks the study's tenant ownership in the SaaS DB (cache), (5) for STOW stores then applies the tenant label. Run the authorization plugin with `authorized-labels` as a defense-in-depth second gate. Rationale: the plugin treats unknown URIs as "system" calls, so whitelisting at the edge closes gaps.
- **UID-collision risk in a shared Orthanc:** Orthanc identifies patients/studies by hashes of DICOM identifiers (background knowledge, verify in the Orthanc Book). If the same study (for example, a patient's CBCT CD) is uploaded by two tenants, both writes land on the same Orthanc resource. The resource then carries two tenant labels, and a delete by one tenant affects the other. Options: (a) per-tenant Orthanc instance (container) with its own DB schema/bucket prefix; (b) a shared instance plus an ingest-time rule that rejects or forks (re-UIDs) a study already owned by another tenant. For dental/ortho clinics, where shared referral CDs are common, (a) is cleaner. Containers per tenant are cheap at small scale (dozens of clinics). A hybrid works too: shared instance for small clinics, dedicated for large ones.
- dcm4chee-arc-light (MPL-1.1, Java/WildFly/LDAP) is more enterprise-oriented and heavier to operate; its MPL license is friendlier than AGPL, but the operational burden argues against it for a small team.
- Managed cloud DICOM services are attractive for storage price (HealthImaging Archive tier $0.006/GB-mo) but add US-provider availability, payment and sanctions-screening risk for a Syria-based company. Self-hosting Orthanc on a regional VPS provider (EU/Turkey/Gulf) is the lower-risk default; revisit managed services when payment and account eligibility are confirmed.

### Gaps
- Exact current license files (COPYING) for orthanc-object-storage and the authorization plugin were not opened directly; the object-storage AGPL label rests on mirror metadata.
- Current Orthanc core version number (Nov 2026) not captured.
- Whether the authorization plugin filters STOW-RS by tenant: not documented.
- Google Cloud Healthcare API and Azure DICOM pricing, and whether Syrian entities can open/pay for AWS, Google Cloud or Azure accounts in 2026: not confirmed.
- Syrian data-residency or health-data law requirements: not researched (outside scope / no sources found).

## 3. Does running GPL/AGPL Orthanc as a separate network service affect the proprietary SaaS code?

### Takeaway
Per the Orthanc project's own licensing FAQ, a proprietary system that only calls Orthanc through its REST API or DICOM is acceptable in all cases, including a proprietary cloud service and with AGPL plugins installed. Obligations arise if you modify or reuse Orthanc/plugin code, or write in-process plugins (C/C++, Lua, Python, Java) while an AGPL plugin is loaded. Dual/commercial licensing is no longer available.

### Cited Findings
- FAQ use-case table: "Using Orthanc as such" — allowed for internal, proprietary-distributed and proprietary-cloud use; "Calling Orthanc via REST API or DICOM" — allowed for permissive/GPL/AGPL third-party systems in internal, distributed and cloud scenarios, even with AGPL plugins. — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- FAQ table: a third-party C/C++, Lua, Python or Java plugin with no AGPL plugin in use → proprietary distribution "Restricted", proprietary cloud allowed; same with an AGPL plugin in use → proprietary cloud also "Restricted"; derived AGPL plugin or reusing its code → "Restricted" for distributed and cloud. "Restricted" = third-party system "must change its license to GPLv3 (or AGPLv3 if an AGPL plugin is used)". — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- An Orthanc plugin "cannot be licensed under a permissive license (MIT, BSD, Apache…)". The Orthanc server "is a standalone executable, not a software library." — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- Rationale for AGPL plugins: GPL does not stop cloud operators from running modified versions without releasing them (the "ASP loophole"). — [Orthanc licensing FAQ (hg)](https://orthanc.uclouvain.be/hg/orthanc-book/file/default/Sphinx/source/faq/licensing.rst)
- Dual licensing: Osimis was the only entity able to grant exceptions and ceased to exist end of January 2024; dual licensing is "no longer available and never will be again" for versions with UCLouvain code; the last eligible version was Orthanc 1.9.7 (2021-08-31). Since Feb 2024 no CLA is required. — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- OrthancFramework sources are LGPLv3 since Orthanc 1.7.2. — [Orthanc licensing FAQ (hg revisions)](https://orthanc.uclouvain.be/hg/orthanc-book/file/default/Sphinx/source/faq/licensing.rst)

### Inferences
- The SaaS backend, the React app and a forked OHIF (MIT) can remain closed if Orthanc and its plugins run **unmodified** as separate containers reached over HTTP/DICOM. Keep a clean process and network boundary.
- **Trap:** a custom Python/Lua plugin (for example, tenant-labelling on ingest or auto-forwarding) running inside an Orthanc that also loads AGPL plugins (DICOMweb, PostgreSQL, auth, object storage) is "Restricted" for proprietary cloud. Either publish such scripts under AGPLv3 (usually acceptable for small glue code) or move the logic out of process: an external worker that polls `/changes` or reacts to the auth plugin's web-service callbacks over HTTP.
- If any AGPL plugin is patched (for example, to add tenant filtering to DICOMweb), the modified source must be offered to network users. Prefer upstream contributions or keep patches public.
- The AGPL network clause applies to the AGPL component itself (Orthanc plugins), not to separate programs talking to it over the network, per the FAQ's REST/DICOM row. This matches common GPL/AGPL understanding, but it is not legal advice; obtain a short legal review before launch.

### Gaps
- No Orthanc forum thread retrieved with Sébastien Jodogne's own wording on multi-tenant SaaS specifically; the FAQ table is the authoritative statement used here.

## 4. Ingest paths: browser upload, patient CDs, phone photos, modality C-STORE via edge gateway, dental sensors, pan/CBCT, intraoral scans

### Takeaway
Plan three ingest channels: (1) browser upload (files, folders, DICOMDIR CDs) with client-side parsing/validation and resumable STOW via the gateway; (2) a clinic edge box (Orthanc on a mini-PC + UPS) that receives C-STORE from panoramic/CBCT/CR units and forwards over HTTPS with compression and retries; (3) a Windows "capture bridge" agent for intraoral sensors/cameras (TWAIN or vendor SDK), because a browser cannot drive USB sensor drivers. Intraoral scanner meshes (STL/PLY) can be stored natively or encapsulated in DICOM via the Orthanc STL plugin and viewed with three.js.

### Cited Findings
- Intraoral sensors are usually USB devices driven by the maker's driver on the operatory PC; a browser tab cannot load that driver, so cloud products ship a local capture app, background agent or plug-in that receives the image, attaches patient/tooth and queues upload. Ask vendors about offline behaviour (capture continues? where images wait? sync and duplicate prevention?), since it is "rarely documented". — [Mindbowser cloud dental imaging](https://www.mindbowser.com/cloud-dental-imaging-software/)
- PMS bridges (Open Dental example) pass patient name, DOB and patient/chart number; a mismatched identifier opens the wrong or a blank patient. — [Mindbowser](https://www.mindbowser.com/cloud-dental-imaging-software/)
- Curve Dental: native cloud capture "directly and instantly to the cloud"; compatible with most digital x-ray sensors and intraoral cameras; TWAIN-compatible panographs "plug and play", though manufacturer drivers may be needed; Air Techniques ScanX integrated; AI via Pearl Second Opinion. — [Curve imaging FAQ](https://www.curvedental.com/blog/considering-curve-cloud-based-dental-imaging-software-faqs); [DentistryIQ](https://www.dentistryiq.com/front-office/software/article/16357050/curve-digital-imaging); [Dental Products Report](https://dentalproductsreport.com/view/scanx-digital-imaging-system-seamlessly-integrates-curve-dentals-cloud-software-video); [Curve "bridge vs integration vs native" paper](https://www.curvedental.com/hubfs/Orange%20Papers/Communicating%20with%20Dental%20Imaging%20Software%20Bridge%20vs.%20Integration%20vs.%20Native.pdf)
- Commercial SDK route: Dynamsoft Dynamic Web TWAIN is marketed for capturing dental imaging hardware (TWAIN/UVC) into web apps. — [Dynamsoft blog](https://www.dynamsoft.com/blog/insights/capture-dental-images-web-application-twain-uvc/)
- CBCT exports: multi-file DICOM "typically 150-600+ files"; single-file export typically 20–200 MB; exports <20 MB may be incomplete; reject proprietary formats (.xstd, .opt). Intraoral scans are usually STL or PLY; one scanner's native format uses `.dcm` but is not DICOM. — [Mindbowser](https://www.mindbowser.com/cloud-dental-imaging-software/)
- CBCT size by FOV: small 50–150 MB, medium 150–400 MB, large 400 MB–1 GB. — [BeamReaders DICOM export requirements](https://help.beamreaders.com/a-62-understanding-dicom-export-requirements)
- Relevant standards: DICOM = ISO 12052; ADA Technical Reports 1023 (DICOM implementation in dentistry) and 1057 (digital imaging interoperability); DICOMweb STOW-RS/QIDO-RS/WADO-RS. — [Mindbowser](https://www.mindbowser.com/cloud-dental-imaging-software/)
- Orthanc ingest-time transcoding: `IngestTranscoding` (e.g., to JPEG Lossless `1.2.840.10008.1.2.4.70`) applies to anything received via DICOM or REST; falls back to the original syntax on failure. Over the DICOM protocol Orthanc only decompresses, never compresses. JPEG 2000 requires the GDCM plugin. Transcoding since 1.7.0; ingest options since 1.8.2. — [Orthanc transcoding FAQ](https://orthanc.uclouvain.be/book/faq/transcoding.html)
- Transfers accelerator plugin (edge → central over WAN): transfers "entirely built over HTTP/HTTPS"; buckets gzip-compressed (estimated 2–3× less volume on typical images); small instances grouped and large split (default `BucketSize` 4096 KB) to avoid TCP congestion issues on poor links; `MaxHttpRetries` (default 0) and `HttpTimeout` tunable; jobs can be paused/cancelled/resubmitted; push (HTTP PUT, simpler) or pull mode; atomic per study/series with MD5-based storage commitment. — [Orthanc Transfers accelerator](https://orthanc.uclouvain.be/book/plugins/transfers.html)
- Orthanc STL plugin: stores STL as DICOM "Encapsulated 3D Manufacturing Model" instances attached to a study, extract via `/instances/{id}/stl`; web viewers: custom Three.js viewer and Online 3D Viewer; Nexus models (v1.1) with 3DHOP (v1.2); can generate meshes from RT-STRUCT and NIfTI; STL creation needs Orthanc ≥1.12.1. PLY not mentioned. — [Orthanc STL plugin](https://orthanc.uclouvain.be/book/plugins/stl.html)
- Worklists plugin exists (for pushing patient demographics to modalities). — [Orthanc plugins list](https://orthanc.uclouvain.be/book/plugins.html)

### Inferences
- **Browser upload (release 1):** `<input webkitdirectory>` / drag-drop of folders and CD contents; parse headers client-side (dcmjs / dicom-parser, both MIT per background knowledge, verify) to validate (SOP Class, PatientID/Name, StudyInstanceUID, transfer syntax), group by study, show a pre-upload summary for patient matching, then upload in chunks (resumable, for example tus or STOW per instance with retry) through the gateway. Accept DICOMDIR media but upload the referenced files, not the DICOMDIR itself. Optionally compress losslessly before upload. Browser-side lossless J2K/HTJ2K encoders exist as WASM codecs used by Cornerstone (background knowledge).
- **Phone photos of films / paper:** keep originals as JPEG attachments in the EHR. Optionally wrap them as DICOM Secondary Capture (SOP Class 1.2.840.10008.5.1.4.1.1.7, background knowledge) so they appear in the viewer timeline, clearly flagged "photo of film – not diagnostic quality, no calibration". Never auto-assign PixelSpacing; measurements need manual calibration.
- **Edge gateway (Tier 1, for clinics with DICOM-capable pan/CBCT/CR/DX):** fanless mini-PC + UPS, Orthanc (SQLite or local PostgreSQL), Worklists plugin, local OHIF plugin for LAN viewing during outages. Auto-forward to cloud with the Transfers accelerator (push mode, gzip, `MaxHttpRetries` > 0, longer `HttpTimeout`), or a small out-of-process forwarder with retry queue. Keep N days locally as cache. The edge box doubles as the clinic-side cache for fast viewing of recent studies.
- **Upload math at Syrian speeds:** a 300 MB CBCT is about 2,400 Mbit, roughly 13 min at 3 Mbps, and a 1 GB CBCT roughly 45 min, before compression (the 2–3× gzip/lossless gains would roughly halve this). This makes store-and-forward plus resumable transfers mandatory, and CBCT viewing should usually happen on the clinic LAN, not round-tripping via cloud. Note that 3 Mbps is a download median; uplink is likely lower (unverified).
- **Dental capture bridge (Tier 1–2):** a Windows tray agent (Electron/.NET) that (a) acquires via TWAIN (or vendor SDK where TWAIN is absent), (b) watches vendor export folders as a fallback (many dental imaging apps can auto-export DICOM/JPEG), (c) wraps into DICOM with patient/tooth tags, (d) queues offline and uploads, (e) is launched from the web app via custom URL scheme with a one-time token. Start with "folder-watch + DICOM import" because it works with any vendor software already installed in Syrian clinics, then add TWAIN.
- **Intraoral scans:** store STL/PLY as attachments (or as DICOM encapsulated STL via the Orthanc STL plugin for STL only); render with three.js `STLLoader`/`PLYLoader` in the React app. Meshes are usually tens of MB (unverified), so lazy-load them.

### Gaps
- No concrete documentation found on how Dentally's imaging bridge works (searches returned Curve only).
- Typical per-image sizes of intraoral sensor images, panoramics and cephalometrics: no authoritative source retrieved.
- dcmjs / dicom-parser current versions and licenses were not verified in this session.
- No source found on Orthanc edge "store-and-forward" with automatic retry as a packaged feature beyond the Transfers accelerator; community Lua/Python auto-routing patterns not retrieved.

## 5. Performance on slow links: progressive loading, JPEG 2000 / HTJ2K, lossy vs lossless, server vs client rendering, edge caching, study sizes and storage cost

### Takeaway
Cornerstone3D/OHIF support progressive loading with HTJ2K (RPCL, streaming or byte-range), which gives a usable first image from about 128 KB instead of a full multi-MB frame. The server side is the bottleneck: HTJ2K is "not yet widely supported", and Orthanc's documented transcoding covers JPEG/JPEG 2000 but not HTJ2K. Lossy compression is professionally accepted for diagnosis at modality-specific ratios (CAR, ESR), but storing lossless and serving lossy/progressive previews is the safer default. Storage per clinic is modest (tens to low hundreds of GB/year), so bandwidth, not storage cost, is the constraint.

### Cited Findings
- Cornerstone3D progressive loading: stacks can be decoded while an HTJ2K RPCL stream arrives; streaming enabled via retrieve configuration (`streaming: true`); clients can request HTJ2K standards-compliantly with `accept=image/jhc`; `initialChunkSize` default 128 KB; `decodeLevel: 0` advised for partial HTJ2K retrieves. — [Cornerstone stack progressive](https://cornerstonejs.org/docs/concepts/progressive-loading/stackProgressive); [retrieve configuration](https://cornerstonejs.org/docs/concepts/progressive-loading/retrieve-configuration)
- Docs benchmark (per search snapshot): byte-range 2-stage HTJ2K initial transfer 128 KB vs 11.1 MB full, first render ~45 ms vs ~66 ms, final ~4.6 s vs ~5.1 s. — [Cornerstone progressive loading](https://cornerstonejs.org/docs/concepts/progressive-loading/); same numbers appear in [DICOM Sup 235 slides](https://www.dicomstandard.org/news-dir/progress/docs/sups/sup235-slides.pdf) (not independent)
- Transfer syntax notes: `1.2.840.10008.1.2.4.202` (HTJ2K RPCL) reliably streamable; `1.2.840.10008.1.2.4.96` is a private pre-ratification UID; `.203` (lossy) "attempted, may not be supported". — [Cornerstone progressive docs](https://cornerstonejs.org/docs/concepts/progressive-loading/stackProgressive)
- Server requirements: stream HTJ2K respecting RPCL, support HTTP Range requests; "support varies significantly across DICOMweb implementations"; HTJ2K "not yet widely supported". Non-HTJ2K progressive alternatives exist (e.g., lower-resolution/lossy first pass). — [Cornerstone progressive requirements](https://cornerstonejs.org/docs/concepts/progressive-loading/requirements); [non-HTJ2K progressive](https://cornerstonejs.org/docs/concepts/progressive-loading/non-htj2k-progressive)
- DICOM Sup 235 adds lossless and lossy HTJ2K transfer syntaxes and HTJ2K as a DICOMweb rendered media type; HTJ2K is royalty-free. — [Sup 235 slides](https://www.dicomstandard.org/news-dir/progress/docs/sups/sup235-slides.pdf)
- Orthanc transcoding docs name JPEG (incl. lossless) and JPEG 2000 (via GDCM) but do not mention HTJ2K; `DicomLossyTranscodingQuality` controls lossy JPEG quality. — [Orthanc transcoding FAQ](https://orthanc.uclouvain.be/book/faq/transcoding.html)
- OHIF community thread on open-source progressive HTJ2K DICOM serving (Azure) shows that servers must provide it; "ANY HTJ2K encoding in progressive mode can be displayed progressively by reading the stream progressively". — [OHIF community HTJ2K thread](https://community.ohif.org/t/open-source-solutions-for-progressive-htj2k-dicom-serving-on-azure/2024)
- Lossy compression: Canadian Association of Radiologists accepted irreversible compression "for use in primary diagnosis and clinical review" with JPEG/JPEG 2000 at modality/body-part-specific ratios (Koff et al., J Digit Imaging 2009; thin-slice CT update 2013); ESR position paper proposes "diagnostically acceptable irreversible compression". — [CAR evaluation (McMaster)](https://experts.mcmaster.ca/display/publication1009622); [Koff 2013 update](https://link.springer.com/content/pdf/10.1007/s10278-012-9542-y.pdf); [ESR position paper](https://link.springer.com/content/pdf/10.1007/s13244-011-0071-x.pdf)
- Average study sizes (undated table): CR 14.1 MB, CT 153.4 MB, MRI 98.6 MB, ultrasound 69.2 MB, mammography 83.5 MB. — [Edenmed whitepaper](https://edenmed.com/whitepapers/radiological-images-size-weight-and-quality). Per-image: ~0.5 MB CT/MR slice (512×512), ~10 MB CR image (2007 data). — [AuntMinnie](https://www.auntminnie.com/imaging-informatics/article/15582698/ct-mr-cr-and-digital-mammo-are-critical-to-archive-storage-forecasts). Study sizes "vary significantly per region, by organization, by modality, and by body part". — [RSNA 2010 abstract](https://archive.rsna.org/2010/9009091.html)
- CBCT 50 MB–1 GB depending on FOV (see section 4). — [BeamReaders](https://help.beamreaders.com/a-62-understanding-dicom-export-requirements)
- Transfers accelerator gzip gives an estimated 2–3× reduction. — [Orthanc Transfers accelerator](https://orthanc.uclouvain.be/book/plugins/transfers.html)
- Storage price reference: AWS HealthImaging $0.105/GB-mo (frequent), $0.006/GB-mo (archive instant access). — [AWS HealthImaging pricing](https://aws.amazon.com/healthimaging/pricing)

### Inferences
- **Serving strategy:** store originals losslessly (as received, or JPEG-LS/J2K lossless). Generate on ingest (out-of-process worker) (a) HTJ2K RPCL derivatives for progressive viewing, served from a static-DICOMweb-style path or object storage with Range support, and (b) small JPEG/WebP thumbnails and "rendered" previews for chart views on phones. Until HTJ2K derivation is built, use Orthanc DICOMweb with JPEG lossy rendered frames for previews and full lossless on demand.
- **Server-side vs client-side rendering:** client-side (Cornerstone WASM decode) is right for 2D X-rays and intraoral images once cached. For CBCT/CT MPR/3D over 3 Mbps, client-side requires downloading the whole volume (100s of MB), so either (1) view on the clinic LAN from the edge box, (2) pre-cache overnight to clinic edge/PC, or (3) later add server-side rendering (not researched here). For release 1, prefer (1) and (2).
- **Edge caching:** the clinic edge box acts both as ingest gateway and as a read cache. The SaaS viewer can be pointed at the edge DICOMweb when on clinic LAN (detect via local DNS name or health check) and at cloud otherwise.
- **Storage estimate per clinic per year (assumptions, not sourced):**
  - Orthopedic clinic: 25 X-ray studies/day × ~14 MB × 300 days ≈ 105 GB/yr, plus outside CT/MR CDs (3/week × ~125 MB × 50) ≈ 19 GB, totalling about 125 GB/yr. At $0.105/GB-mo (HealthImaging frequent tier) the year-end monthly cost is ≈ $13/mo; S3-compatible or VPS block storage is likely cheaper.
  - Dental clinic with CBCT: 3 CBCT/week × ~250 MB × 50 ≈ 37 GB; 2D intraoral/pan, assuming ~40 images/day at ~1–5 MB (assumed), ≈ 12–60 GB. Total about 50–100 GB/yr.
  - Dental clinic without CBCT: likely <30 GB/yr.
  - Conclusion: storage cost per clinic is a few US$ per month. Bandwidth, edge hardware (mini-PC + UPS, about a few hundred US$, unverified) and support time dominate.
- **Lossy for diagnosis:** offer lossy only for previews and progressive first pass, always reaching lossless final quality for diagnostic reads; show a "lossy" indicator in the viewer.

### Gaps
- Actual CAR ratio table (e.g., CR/DX, CT) not retrieved.
- Whether Orthanc (core/DICOMweb/GDCM) can transcode to HTJ2K in 2026: not found in the docs read.
- No measured benchmarks of OHIF over 3 Mbps / high-latency links found.
- Server-side rendering options (for example, MedDream server rendering or remote-render frameworks) not researched.
- Uplink speeds in Aleppo/Azaz not sourced.

## 6. Dental and orthopedic imaging expectations

### Takeaway
Dentists expect mount-based workflows (FMX ~18–20 images, bitewing and periapical mounts), tooth-linked images (tooth range stored in DICOM), enhancement filters, calibrated measurements, and later CBCT implant planning. Orthopedists expect serial X-ray comparison (side-by-side/hanging protocols), length/angle/Cobb measurements with calibration, and later templating. OHIF covers the orthopedic needs out of the box; the dental mount workflow must be built.

### Cited Findings
- FMX typically 18–20 images combining periapicals and bitewings; pediatric mixed-dentition layouts differ. — [Planet DDS support article](https://support.planetdds.com/hc/en-us/articles/52489284920475--DRAFT-Types-of-Dentistry-and-the-layouts-images-they-take)
- DTX Studio: when intraoral images are exported in DICOM, the set tooth range is saved inside the DICOM file so third-party apps recognize tooth numbers; images are sorted into layout placeholders with default FMX or vertical bitewing templates. — [DTX Studio Intraoral RX Workspace help](https://helpfiles.dtxstudio.com/Help/50784413-8047-4699-82f7-d1e9a868909e/4.5/EN/Intraoral_workspace.htm)
- PaxeraDental (web dental PACS): hanging protocols including various FMX templates, interactive customization of FMX templates, zero-footprint viewer for mobile devices and browsers. — [DrBicuspid: Paxeramed web-based dental PACS](https://www.drbicuspid.com/clinical/imaging-cad-cam/3d-printing/article/15367771/paxeramed-offers-web-based-dental-pacs)
- Mounting convention (US): labial mounting, viewed as if facing the patient, maxillary periapicals on top (exam-prep source; verify). — [Open Exam Prep: viewing mounting landmarks](https://open-exam-prep.com/study-guides/danb-rhs/mounting-legal/viewing-mounting)
- Calibration: without PixelSpacing, OHIF measurements show in pixels until calibrated with the Calibration Line tool. — [OHIF community thread](https://community.ohif.org/t/change-units-for-length-tool/1420); [OHIF CalibrationLineTool](https://docs.ohif.org/coverage/extensions/cornerstone/src/tools/calibrationlinetool.ts)
- Cobb angle tool exists in Cornerstone3D. — [CobbAngleTool API](https://cornerstonejs.org/docs/api/tools/classes/CobbAngleTool)
- ADA TR 1023 covers DICOM implementation in dentistry. — [Mindbowser](https://www.mindbowser.com/cloud-dental-imaging-software/)

### Inferences
- **Dental viewer must-haves (release 1–2):** mount templates (FMX 18/20, 4-BW, 2-BW, vertical BW, pediatric), drag-and-drop images into slots, tooth number assignment (FDI notation by default in Syria, Universal optional; FDI preference is background knowledge), per-tooth image history in the odontogram/chart, quick filters (brightness/contrast/window, invert, sharpen, gamma, pseudo-color), rotate/flip, calibrated length/angle, annotations, and "compare with previous" per tooth. These are best built as a custom React + Cornerstone3D "dental workspace" rather than inside OHIF.
- **Orthopedic must-haves:** hanging protocol "current vs prior" for same body part/view (OHIF hanging protocols), length, angle, Cobb angle, ellipse ROI, calibration by known marker size (for example, a 25 mm calibration ball), and annotations saved per study (DICOM SR or SaaS DB). Templating (implant overlays) is a later, possibly commercial add-on.
- **CBCT:** MPR + panoramic curve reconstruction + nerve canal tracing + implant planning are specialized dental tools. OHIF gives generic MPR/3D only, so release 1 should promise "CBCT viewing (MPR)" and leave planning to vendor desktop software (or Weasis/vendor viewers) for now.

### Gaps
- No authoritative DICOM spec citation retrieved for how tooth numbers are encoded (e.g., Anatomic Region / Primary Anatomic Structure codes) or for a standard FMX hanging-protocol definition.
- No source found on Syrian dentists' specific workflow conventions (FDI vs other, mounting orientation).
- No source on orthopedic digital templating products/licensing.

## 7. AI imaging (later): dental caries/periapical detection, fracture detection, regulatory caveats

### Takeaway
Commercial cleared dental AI exists (Pearl Second Opinion: 510(k) for bitewing/periapical findings and, since Dec 2025, panoramic caries, periapical radiolucencies and impacted third molars). The best-known open panoramic dataset (DENTEX) is non-commercial (CC BY-NC-SA 4.0 per its repo), which limits training a commercial model on it. Treat AI as a later, opt-in "second opinion" feature with clear non-diagnostic labelling until a regulatory path in Syria is understood.

### Cited Findings
- Pearl received FDA 510(k) clearance (Dec 2025) for Second Opinion on panoramic X-rays: suspected caries, periapical radiolucencies, impacted third molars; based on standalone and fully crossed MRMC studies. An earlier clearance covered caries, margin discrepancies, calculus and periapical radiolucency (intraoral). Company claims 36% more lesions identified with AI assistance. — [BusinessWire / Pearl, 2025-12-18](https://www.businesswire.com/news/home/20251218983939/en/Pearl-Expands-Dental-AI-Capabilities-with-FDA-Clearance-for-Panoramic-X-Rays); [Becker's Dental](https://www.beckersdental.com/ai-teledentistry/pearl-earns-fda-clearance-for-dental-pathology-in-panoramic-x-rays/); [Becker's: first FDA clearance](https://beckersdental.com/ai-teledentistry/38045-world-s-1st-ai-software-that-reads-dental-x-rays-gains-fda-clearance.html)
- Curve integrates Pearl's Second Opinion (example of AI via partner API in a cloud PMS). — [Curve imaging FAQ](https://www.curvedental.com/blog/considering-curve-cloud-based-dental-imaging-software-faqs)
- DENTEX: 1,005 fully annotated panoramic X-rays (705/50/250 split) + 1,571 unlabeled; classes: caries, deep caries, periapical lesions, impacted teeth. License conflict: arXiv paper says CC-BY; GitHub repo and Hugging Face card say CC BY-NC-SA 4.0 (non-commercial); code is MIT. — [DENTEX arXiv](https://arxiv.org/pdf/2305.19112); [DENTEX GitHub](https://github.com/ibrahimethemhamamci/DENTEX); [Zenodo record](https://zenodo.org/records/7812323)
- dwv and OHIF-type open viewers are not cleared for diagnosis (dwv states "not certified for diagnostic use"). — [dwv README](https://github.com/ivmartel/dwv/blob/master/readme.md)
- OHIF v3.10 added AI-powered segmentation tools (interactive, in-viewer). — [OHIF release notes](https://ohif.org/release-notes)

### Inferences
- Architecture hook to build now: an "AI findings" side-channel (DICOM SR or SaaS JSON overlays linked to SOPInstanceUID + tooth number), so a third-party API (Pearl, Overjet, Diagnocat, or a self-hosted model) can be plugged in later without changing storage.
- Training a commercial model on DENTEX is legally risky given the NC-SA license; local data collection with consent, or licensed datasets, would be needed.
- Regulatory: FDA/CE clearances apply to specific vendor software, not to the SaaS that embeds results. Present AI as decision support, require clinician confirmation, and log model versions.

### Gaps
- Overjet, Diagnocat and other vendors' clearance status and API availability/pricing for Syria: not retrieved.
- Open fracture-detection models (orthopedic X-ray) and their licenses: no sources found in this session.
- Syrian Ministry of Health rules for medical-device software / AI: no sources found.

## 8. Recommended imaging architecture and tiered rollout

### Takeaway
Build on unmodified Orthanc (Docker, PostgreSQL, S3-compatible storage, DICOMweb + authorization plugins) behind a proprietary DICOMweb gateway that enforces tenant isolation. Use a forked OHIF v3.13 (MIT) for the diagnostic viewer plus a custom Cornerstone3D dental workspace. Ingest via browser upload in release 1, and an edge Orthanc box and a capture-bridge agent for clinics with modalities/sensors. This keeps proprietary code license-clean and fits slow links and power cuts.

### Cited Findings
- REST/DICOM interaction with Orthanc is allowed for proprietary cloud services even with AGPL plugins; in-process plugins with AGPL plugins loaded are restricted. — [Orthanc licensing FAQ](https://orthanc.uclouvain.be/book/faq/licensing.html)
- OHIF and Cornerstone3D are MIT. — [OHIF release notes](https://ohif.org/release-notes); [cornerstone3D GitHub](https://github.com/cornerstonejs/cornerstone3D/)
- Authorization plugin supports label-based user profiles, filters `tools/find` and DICOMweb QIDO, and treats unknown URIs as `system`. — [Orthanc authorization plugin](https://orthanc.uclouvain.be/book/plugins/authorization.html); [NEWS](https://orthanc.uclouvain.be/hg/orthanc-authorization/file/default/NEWS)
- Transfers accelerator gives HTTPS, gzip, retryable, atomic edge→central transfers. — [Orthanc Transfers accelerator](https://orthanc.uclouvain.be/book/plugins/transfers.html)
- Cornerstone3D HTJ2K progressive loading requires server support (Range/streaming). — [Cornerstone requirements](https://cornerstonejs.org/docs/concepts/progressive-loading/requirements)

### Inferences
**Target architecture (logical):**
1. **Cloud imaging core (per region; VPS/managed Kubernetes or plain Docker Compose):**
   - Orthanc (official `orthancteam/orthanc` image, unmodified) + PostgreSQL plugin (index) + object-storage plugin to an S3-compatible bucket (MinIO on the VPS, or a provider) with plugin encryption on; DICOMweb plugin; authorization plugin; GDCM plugin. Not publicly reachable.
   - Tenancy: start with **one Orthanc container per tenant** (shared PostgreSQL server, separate database each; shared bucket with per-tenant prefix or bucket). This avoids cross-tenant UID collisions and makes deletion/export per clinic trivial. Use labels inside each instance for branch/department. Move to a shared instance + labels only if tenant count makes per-tenant containers unmanageable.
   - **Imaging gateway (proprietary, in the SaaS backend):** issues short-lived viewer tokens; maps tenant → Orthanc upstream; whitelists DICOMweb routes (QIDO/WADO-RS/WADO-URI/STOW); audits every access; handles resumable uploads; generates expiring share links.
   - **Imaging worker (proprietary, out of process):** consumes Orthanc `/changes`; extracts metadata into the SaaS DB (patient match, tooth numbers, modality); creates thumbnails/previews; later HTJ2K derivatives; calls AI APIs later.
2. **Viewer layer:** forked OHIF v3.13 (pin version; Arabic i18next bundle; LTR canvas; tenant token injection; dental/ortho hanging protocols) served from the SaaS domain. A custom React + Cornerstone3D component for chart thumbnails, FMX/bitewing mounts and side-by-side comparison. three.js for STL/PLY.
3. **Clinic edge (optional per clinic):** mini-PC + UPS running Orthanc (SQLite), Worklists, local OHIF plugin, Transfers accelerator push to the cloud tenant instance; local retention of recent N months; LAN-first viewing of CBCT.
4. **Capture bridge (Windows agent):** folder-watch + DICOM/JPEG import first, then TWAIN; offline queue; deep-link launch from the web app.

**Tiered rollout:**
- **Tier 0 / Release 1 (MVP, 0–3 months):** cloud Orthanc per tenant + gateway; OHIF fork (2D, MPR for CT/CBCT, measurements incl. length/angle/Cobb/ellipse ROI, calibration, annotations, prior comparison); browser upload of DICOM files/folders/CD (DICOMDIR) with client-side validation and resumable upload; phone photos stored as JPEG attachments (optionally SC-wrapped, flagged non-diagnostic); basic dental mount view (FMX/BW templates, manual tooth tagging); Arabic UI around the viewer; audit logs; share links. Storage: lossless as received.
- **Tier 1 (3–6 months):** edge gateway kit for clinics with pan/CBCT/CR (C-STORE → edge → cloud via Transfers accelerator); capture-bridge agent (folder-watch, then TWAIN) for intraoral sensors/cameras; per-tooth image history in the odontogram; thumbnails/previews for mobile; tablet-optimized single-viewport mode.
- **Tier 2 (6–12 months):** progressive loading (HTJ2K derivatives + Range-capable serving) and LAN/cloud auto-switching; STL/PLY intraoral scan viewer; ortho hanging protocols for serial follow-up; referral/patient portal image sharing; evaluate MedDream OEM if a regulatory-cleared viewer becomes a sales requirement.
- **Tier 3 (12+ months):** AI second-opinion integration via partner API (dental caries/periapical; fracture detection), CBCT implant planning and ortho templating (likely via partner/desktop tools), optional managed cloud archive tier (for example, HealthImaging archive) once account and payment eligibility from Syria is confirmed.

**Risk notes:** keep custom code outside Orthanc's process (AGPL); budget for an Orthanc Team support contract if relying on object-storage plugins; test OHIF on target tablets early; design everything for interrupted uploads and offline clinics.

### Gaps
- No measured end-to-end tests of this stack on Syrian links; a pilot at one Aleppo clinic with real pan/CBCT data is needed to validate the timing assumptions.
- Costs of mini-PC/UPS hardware in Syria and VPS providers reachable from Syria with acceptable latency were not researched.
