# Spike 0.3-S7 push: analysis

Pass mark (OD-52): every graded state and the one-day run ≥ 95% shown within 60 s, no message lost, every excluded state detectable.

**Verdict: pass**

| Run | State | API | Graded | n | Expected | Shown | ≤ 60 s | ≤ 60 s % | p50 s | p95 s | max s | Collapsed | Expired | Inbox only | Lost | Detectable | Skew drift |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-20-background-api33 | background | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.3 | 1.5 | 1.6 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-bucket-rare-api33 | bucket-rare | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.3 | 0.4 | 0.8 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-bucket-restricted-api33 | bucket-restricted | 33 | excluded | 20 | 20 | 20 | 20 | 100 | 0.4 | 1.4 | 2.1 | 0 | 0 | 0 | 0 | last seen only | ok |
| 2026-11-20-channel-off-api33 | channel-off | 33 | excluded | 20 | 20 | 1 | 1 | 5 | 0.5 | 0.5 | 0.5 | 0 | 0 | 19 | 0 | channel in device state | ok |
| 2026-11-20-doze-api33 | doze | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.3 | 0.4 | 0.8 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-doze-api33-attempt1 | doze | 33 | recorded | 20 | 20 | 7 | 7 | 35 | 0.3 | 26.8 | 26.8 | 0 | 0 | 13 | 0 | – | ok |
| 2026-11-20-doze-api33-noshow | doze (noshow) | 33 | recorded | 20 | 20 | 20 | 20 | 100 | 0.3 | 4 | 5.7 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-force-stopped-api33 | force-stopped | 33 | excluded | 20 | 20 | 8 | 0 | 0 | 123.6 | 362.1 | 362.1 | 0 | 0 | 12 | 0 | last seen only | ok |
| 2026-11-20-foreground-api33 | foreground | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.3 | 0.4 | 0.7 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-foreground-api33-noshow | foreground (noshow) | 33 | recorded | 20 | 20 | 20 | 20 | 100 | 0.3 | 0.9 | 14 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-offline-ttl-expire-api33 | offline-ttl-expire | 33 | graded | 20 | 0 | 0 | 0 | 100 | – | – | – | 0 | 20 | 0 | 0 | – | ok |
| 2026-11-20-offline-ttl-expire-nocollapse-api33 | offline-ttl-expire-nocollapse | 33 | graded | 20 | 0 | 0 | 0 | 100 | – | – | – | 0 | 20 | 0 | 0 | – | ok |
| 2026-11-20-offline-ttl-long-api33 | offline-ttl-long | 33 | graded | 20 | 1 | 1 | 1 | 100 | 1 | 1 | 1 | 19 | 0 | 0 | 0 | – | ok |
| 2026-11-20-pending-limit-api33 | pending-limit | 33 | recorded | 120 | 120 | 1 | 1 | 0.8 | 1 | 1 | 1 | 0 | 0 | 119 | 0 | – | ok |
| 2026-11-20-pending-limit-collapsed-api33 | pending-limit-collapsed | 33 | recorded | 120 | 1 | 1 | 1 | 100 | 0.8 | 0.8 | 0.8 | 119 | 0 | 0 | 0 | – | ok |
| 2026-11-20-permission-denied-api33 | permission-denied | 33 | excluded | 20 | 20 | 0 | 0 | 0 | – | – | – | 0 | 0 | 20 | 0 | permission in device state | ok |
| 2026-11-20-reboot-api33 | reboot | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.8 | 1.1 | 19.6 | 0 | 0 | 0 | 0 | – | over 50 ms |
| 2026-11-20-screen-off-api33 | screen-off | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.3 | 0.7 | 8.8 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-slow-link-api33 | slow-link | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.4 | 0.7 | 1 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-swiped-api33 | swiped | 33 | graded | 20 | 20 | 20 | 20 | 100 | 0.3 | 0.5 | 0.6 | 0 | 0 | 0 | 0 | – | ok |

## Lost messages

None.
