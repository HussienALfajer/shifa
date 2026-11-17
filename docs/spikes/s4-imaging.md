# Spike S4 result: imaging storage, upload, edge push and viewing

Date: 2026-11-16/17 (local runs; CI bench dispatch after merge) · Spec: [0.3-S4](../specs/spikes/0.3-s4-imaging.md) · Slices: [0.3-S4a](../slices/0.3-s4a-imaging-stack-and-gateway.md), [0.3-S4b](../slices/0.3-s4b-imaging-upload-viewing-result.md), [0.3-S4c](../slices/0.3-s4c-imaging-bench-and-result.md) · Decision: [ADR-0035](../adr/0035-imaging-storage-upload-and-edge-push.md) (Accepted, owner 2026-11-17), amending [ADR-0019](../adr/0019-imaging-orthanc-ohif.md) · Requirements: IMG-02, IMG-03, IMG-04, IMG-06, IMG-14, IMG-17, IMG-25 · Open: OD-18

## Answer
**ADR-0019's plan works with Garage, a bucket per tenant and our own chunked upload. Browser upload is acceptable for a 300 MB CBCT on every profile. On a 1 Mbit/s uplink with line drops a 1 GB CBCT takes about three hours by either path, so clinics with a CBCT need the edge box for unattended sending, and its push must resume instead of starting over.**

- **Garage + Orthanc S3 plugin:** store, read and delete work, and every instance comes back byte for byte (SHA-256). Encryption is on from the first write: no stored object holds `DICM` or a source pixel run, and an Orthanc with a wrong key refuses to read. Its cost is within run-to-run noise (below).
- **Bucket per tenant, not prefix per tenant.** Garage grants per bucket; in a shared bucket tenant A's key listed and read tenant B's objects (`.verify/s4/bucket-layout.json`).
- **Upload time on P1 (1 Mbit/s up, 1 % loss, a 30 s line drop every 5 min):** 300 MB in 50 min from the browser (three files at once) and 27 min from the edge box; 1 GB in 2 h 57 min from the browser and 3 h 3 min from the edge box, whose push failed once at a line drop and was pushed again whole (1.13 × the study bytes on the wire instead of 0.56). On P2 (3 Mbit/s) 300 MB takes 15 min from the browser and 8 from the edge box; on P3 (8 Mbit/s) 6 and 3.4 min, 1 GB 20 and 11 min.
- **Chunked resumable upload, not STOW-RS per instance.** On P2 and P3 both reach 85–91 % of the uplink when the chunked upload sends three files at once (one file at a time leaves 10–35 % unused). Under P1's 30 s drops STOW-RS failed both long runs: the 576-file study gave up on an instance whose six attempts (backoff at most about 15 s in total) all fell inside one drop, and the single 300 MB file sent 1.8 GB without storing anything. The chunked upload finished every long run, sent again at most one chunk per interruption, and resumed after a reload from the server's offset.
- **Transfers' gzip saves 45 %** on the synthetic CBCT (0.55 of the study bytes on the wire at every profile and size), so the edge box is about twice as fast as the browser on a clean link. A push job does not survive an edge Orthanc restart, and a failed job is pushed again from the start: on P1 a 1 GB push lost its whole advantage that way. The edge agent needs its own queue that resumes (ADR-0035).
- **Viewing:** OHIF opens the panoramic and the CBCT with MPR through the gateway on P1–P3 and on the edge LAN. First image: panoramic 63 s on P1, 14 s on P2, 8 s on P3, 2 s on the LAN; CBCT 29–40 s on P1, 9 s on P2, 6 s on P3, 2 s on the LAN. The three MPR viewports paint within a tenth of a second of the first image; the full volume streams in afterwards (not timed, see limits). Viewing over P2 and P3 is fine; on P1 it is usable but slow.

## Versions tested
Orthanc 26.11.0 (`orthancteam/orthanc:26.11.0@sha256:06b8baab…`, official image: PostgreSQL index and storage plugins, AWS S3 storage, DICOMweb, Transfers 1.7, GDCM; Orthanc Explorer 2 off) · Garage v2.5.0 (`dxflrs/garage:v2.5.0@sha256:677e5b75…`) · PostgreSQL 18.6 (`postgres:18.6-trixie@sha256:e3d24f69…`) · OHIF v3.13.14 release build (`ohif/app:v3.13.14@sha256:40e50985…`) · Playwright 1.65.1 (Chromium) · link shaper Alpine 3.24.4 with iproute2 `tc` (tbf + netem) and HAProxy · gateway Node 24.22.3 · dcmtk on Debian trixie. Machine: Windows 11 Pro 26200, Intel Core i9-14900HX (32 threads), 32 GB, Docker Desktop 29.2.1 with the WSL2 kernel 6.6.87.2 (tbf and netem from that kernel).

**Test data:** generated studies (OD-44): `cbct-300-multi` (576 files, 302.6 MB), `cbct-300-single` (one multi-frame file, 302.1 MB), `cbct-1g-multi` (800 files, 1.02 GB), 16-bit phantom with noise; a synthetic panoramic (9 MB). Generation: the 300 MB single file in 9.8 s, the 1 GB study in 27.4 s. Public case: Lan Feng, Zhi Li, Qihang Gu, Yaqi Wang, Xiaoyang Yu, *Adults' dental cone beam computed tomography images dataset for detecting and classifying missing teeth*, V2, Science Data Bank, 2026, [doi:10.57760/sciencedb.26465](https://doi.org/10.57760/sciencedb.26465), CC BY 4.0; one NewTom N09 case, its study, series, acquisition and content dates replaced with 19000101 (pinned by SHA-256, never committed).

## Evidence per criterion
Test files are under `spikes/s4-imaging/`. Local runs on the machine above, 2026-11-16 19:51 to 2026-11-17 07:32 (SST). The long runs (`S4_LONG=1`) ran from a snapshot of `main` with the old link shaper (see "What broke"); the bench with the fixed shaper.

| # | Result | Proof |
|---|---|---|
| 1 | Every image pinned by version and digest; 19 clinic-side probes to Orthanc, PostgreSQL and Garage ports get no connection; the gateway through the link answers | `stack/test/images.test.ts`, `network.test.ts` |
| 2 | Only configuration JSON and key files are mounted into Orthanc; scripts, plugins, entrypoint or start-script hooks fail the check | `licence-boundary.test.ts`, `licence-rules.test.ts` |
| 3 | 152 + 1 instances stored and read back, SHA-256 equal; after delete the bucket has no object and Orthanc's statistics are 0 | `garage-roundtrip.test.ts` |
| 4 | No object holds `DICM` or a 64-byte source pixel run; a wrong master key gives an error, the right one the same bytes | `encryption.test.ts` |
| 5 | Two tenants, each with its own Orthanc and database on one PostgreSQL; tenant A's key gets `AccessDenied` on B's bucket (list, get, put); a shared bucket with prefixes is not isolated | `tenant-buckets.test.ts`, `.verify/s4/bucket-layout.json` |
| 6 | Same UIDs in both tenants stay two studies; a viewer token for A gets nothing of B's (QIDO, WADO, STOW); 29 refused routes × 2 tokens with no upstream call; expired and forged tokens refused; one audit row per allowed access | `gateway/test/*.test.ts` |
| 7 | Studies of the planned sizes and frame counts, deterministic; DICOMDIR; public case pinned by SHA-256, PHI check clean after the date clearing | `generator/test/*.test.ts` |
| 8 | **Met for the chunked upload; STOW-RS fails on P1.** Long P1 runs (300 MB, a 30 s line drop every 5 min), each with the cloud copy equal to the source (count and SHA-256): multi-file 99.6 min (20 drops, 20 interruptions, 10.0 MB sent again), single file 102.9 min (21 interruptions, 19.9 MB sent again = one 1 MiB chunk each, 41 link events), reload with the folder re-selected resumed from 92.3 MB on the server (89.0 min), two tabs on one folder end with one copy. STOW-RS: multi-file failed after 53 min (an instance used up its six attempts inside one drop), single file failed after 33 min with 1.8 GB sent and nothing stored. Fast suite (20 MB, 10 s drops): every case passed in 0.3-S4b, STOW-RS multi-file included | `scenarios/test/upload-chunked.spec.ts`, `upload-stow.spec.ts` |
| 9 | **Met.** Long P1 run: 300 MB pushed through drops and an edge restart at 40 % in 38.4 min; the job was lost on restart and pushed again (wire ratio 0.79); the cloud equals the edge copy byte for byte and the source by dataset SHA-256 | `scenarios/test/edge.spec.ts` |
| 10 | **Met.** The panoramic and the 300 MB CBCT render, the CBCT with three MPR viewports, through the gateway on P1, P2, P3 and on the edge LAN (long run and bench) | `scenarios/test/viewer.spec.ts`, bench viewer rows |
| 11 | Bench below; 1 GB on P1 and P3 (and P2 for viewing) | `scenarios/bench/` (`bench:s4`), `.verify/s4/bench-*.json` |
| 12 | This report, ADR-0035 (Accepted, owner 2026-11-17), ADR-0019 status line, OD-18, roadmap, `docs/domain/imaging.md` | — |

## Bench (criterion 11)
`pnpm --dir spikes/s4-imaging/scenarios run bench:s4 …`, one fresh stack per transfer row; P1 rows with the spec's line drops. In brackets: efficiency, i.e. study bytes over wall time over the profile's uplink rate (above 1 for the edge box because of gzip); "wire" is uplink bytes at the shaper over study bytes. Local runs were split over several invocations (`bench-p3`, `-p2`, `-p2b`, `-p2c`, `-p1`, `-p1c`, `-extra`, `-extra3`), because app restarts stopped earlier ones.

### Transfers
| Profile (up) | Study | Chunked, one file | Chunked, three files | STOW-RS (six at once) | Edge push |
|---|---|---|---|---|---|
| P3 (8 Mbit/s) | 300 MB, 576 files | 7.7 min (66 %) | 6.0 min (85 %) | 6.2 min (82 %) | 3.4 min (wire 0.55) |
| P3 | 300 MB, one file | 6.5 min (78 %) | 6.6 min (76 %) | 6.0 min (84 %) | 3.0 min (wire 0.55) |
| P3 | 1 GB, 800 files | 23.3 min (73 %) | 19.7 min (87 %) | 19.8 min (86 %) | 10.7 min (wire 0.55) |
| P2 (3 Mbit/s) | 300 MB, 576 files | 15.7 min (86 %) | 14.9 min (90 %) | 14.7 min (91 %) | 7.9 min (wire 0.55) |
| P2 | 300 MB, one file | 15.1 min (89 %) | 15.0 min (90 %) | 14.7 min (91 %) | 7.7 min (wire 0.55) |
| P1 (1 Mbit/s, drops) | 300 MB, 576 files | 99.6 min (long run, old shaper) | 50.4 / 50.2 min (80 %; two runs; 14.7 / 14.2 MB sent again in 30 / 29 interruptions) | failed (long run) | 26.7 min (wire 0.56) |
| P1 | 1 GB, 800 files | — | 2 h 57 min (77 %; 37 interruptions, 28.7 MB sent again) | — | 3 h 3 min (one failed job pushed again; wire 1.13) |

**Variants on P3, 300 MB multi-file, one file at a time:** chunk 256 KiB 9.4 min (54 %), 1 MiB 7.7 min (66 %), 4 MiB 7.2 min (70 %): a chunk is one request with a round trip and a digest check, so small chunks waste the link. 1 MiB keeps the loss per interruption small on P1; parallel files gain more than larger chunks. **Transfers bucket 4 MB on P3:** 3.1 min against 3.4 min with 512 KB; on P1, 4 MB buckets never arrived whole between drops (0.3-S4b), so 512 KB stays.

### Memory (peak, `docker stats`)
- Cloud Orthanc: 170–210 MiB for multi-file studies of 300 MB; 450–550 MiB during 1 GB transfers; 0.6–1.1 GiB while it stores the 300 MB single file (parsed whole).
- Gateway: 55–110 MiB, except 372 MiB while assembling and storing the 300 MB single file by the chunked protocol (it reads the file whole for STOW-RS).
- **Edge Orthanc: about 1.0 GiB pushing 300 MB, 1.95 GiB pushing 1 GB on P3 and 2.2 GiB on P1.** An edge box needs at least 4 GB of RAM for 1 GB studies (OD-18).

### Encryption overhead (unshaped, through the gateway; tenant b without encryption, then tenant a with)
| Study | Store off / on | Read off / on |
|---|---|---|
| 20 MB (self-test) | 1.8 / 2.0 s | 2.1 / 2.4 s |
| 300 MB, 576 files | 11.8 / 12.6 s | 49.2 / 44.1 s |
| 1 GB, 800 files | 29.6 / 29.9 s | 62.3 / 43.9 s |

Store costs 1–9 % more with encryption; reads vary more between runs than between modes (the encrypted read, second each time, was faster). One run each, read possibly helped by Orthanc's storage cache and the file cache: encryption's cost is below what this bench can resolve, and small next to any link in the spike.

### Viewer (fixed shaper; first image / three MPR viewports painted)
| Place | Panoramic | CBCT 300 MB | CBCT 1 GB |
|---|---|---|---|
| P1 (3 Mbit/s down) | 63.0 s | 28.9 / 29.0 s | 40.2 / 40.3 s |
| P2 (10 Mbit/s) | 14.2 s | 8.6 / 8.7 s | 8.9 / 9.0 s |
| P3 (25 Mbit/s) | 7.9 s | 6.2 / 6.3 s | 6.0 / 6.1 s |
| Edge LAN | 2.1 s | 2.4 / 2.5 s | 2.1 / 2.2 s |

The long run with the old shaper (jitter reordering) gave P1 212 s / 102 s and P3 99 s / 45 s for the panoramic / CBCT; the fix explains the difference.

## What broke and the workarounds
- **Link shaper jitter reordered packets** (0.3-S4b): netem delayed each packet independently, so jitter sent them out of order and TCP throughput collapsed (P3: a 20 MB download took 148 s instead of 6.4 s). With `rate` on netem, packets keep their order (`stack/test/link-jitter.test.ts`). The bench runs with the fix; the long P1 runs used `main`'s shaper (started before the fix), so their times are slower (99.6 against 50 min for 300 MB, also one file at a time against three).
- **STOW-RS per instance cannot ride out a 30 s drop** with six attempts and exponential backoff capped as in the spike (the attempts of one instance end inside one drop). A longer retry budget would help a multi-file study, never a single large file.
- **Transfers:** 1.7 has no `/transfers/info`; a push is `POST /transfers/push`, `PUT /transfers/push/{id}/{n}`, `POST …/commit` (`DELETE …/{id}` on failure). A push job is lost when the edge Orthanc restarts, although `SaveJobs` is on, and a failed job starts over: the harness pushes again; production needs an edge queue that resumes. The peer header is fixed at Orthanc start, so the spike's edge credential lives 12 hours.
- C-STORE rewrites the DICOM file meta group; the dataset after it arrives byte for byte. Edge-path checks compare datasets against the source and files against the edge copy (owner, 2026-11-16).
- OHIF's release image is built for the origin root: the gateway proxies `/viewer` and a strict pattern of static files at the root, cookie-gated. Bulk data URIs are off (Orthanc's name its internal host).
- The viewer cookie is `Secure`; the spike is plain HTTP, so the test browser marks the gateway origin trustworthy, and Chromium still refuses the `__Host-` prefix there (`s4_viewer` in the spike, `__Host-s4_viewer` over TLS in production).
- A plain netem cut only stalls TCP and no request fails; the P1 schedule drops the line (open connections end) so interruptions really happen.

## Limits of these numbers
- **Split TCP:** the link is an HAProxy in TCP mode, so each TCP connection ends at the link and each leg sees half the RTT and one direction's loss. Under P1 this makes throughput look better than end-to-end TCP over a real line.
- **MPR "ready" means three viewports painted**, not the whole volume loaded: OHIF renders while it streams. The time until the full volume is loaded (about the study size over the downlink, e.g. 45 min for 1 GB on P1) was not measured.
- **Browser times include set-up** (page load over the shaped link, copying the folder into the browser container, hashing every file in the page); the edge box's C-STORE on the LAN is outside its timing. Against the edge box this counts a little against the browser.
- One run per row, except P1 300 MB three files (50.4 and 50.2 min). Rows ran beside other stacks (other benches, the long runs) on the same machine; the link, not the CPU, set the pace, but two stacks once timed out starting their browser when four started at once.
- `resentBytes` counts bytes handed to `fetch`, an upper bound; the reload scenario records −1 MiB (the two page loads both count the chunk in flight at the reload). The edge box's wire ratio includes any whole-study push again after a failed job.
- Synthetic phantom with noise: real CBCT compresses differently, so Transfers' 45 % saving is an estimate for real studies.

## Recommendation
- **Clinics with a CBCT, or that send several large studies a day: edge box**, with our agent around Orthanc: a queue that resumes a failed or interrupted push instead of starting over, 512 KB buckets, at least 4 GB of RAM, a UPS (ADR-0035, OD-18). It sends 300 MB in under 30 min even on P1 and needs nobody at the browser; with a resuming push, 1 GB on P1 should take about 1.5 h instead of 3.
- **Clinics without one: browser upload with our chunked protocol, three files at a time, 1 MiB chunks.** 300 MB takes 6 min on P3, 15 on P2 and 50 on P1, survives drops and reloads, and sends again at most one chunk per interruption. 1 GB on P1 (3 h) is possible but should be the exception.
- **Viewing through the gateway is fine on P2 and P3** (first image in under 15 s); on P1 the first image of a CBCT takes 30–40 s and a full volume much longer, so clinics on P1 lines with an edge box should view on the LAN.
