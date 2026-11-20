# Spike 0.3-S7 push: analysis

Pass mark (OD-52): every graded state and the one-day run ≥ 95% shown within 60 s, no message lost, every excluded state detectable.

**Verdict: fail**

- doze (2026-11-20-doze-api33): 75% shown within 60 s, below 95%
- offline-ttl-expire (2026-11-20-offline-ttl-expire-api33): 50% shown within 60 s, below 95%
- offline-ttl-expire (2026-11-20-offline-ttl-expire-api33): lost s7-b4

| Run | State | API | Graded | n | Expected | Shown | ≤ 60 s | ≤ 60 s % | p50 s | p95 s | max s | Collapsed | Expired | Inbox only | Lost | Detectable | Skew drift |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-20-doze-api33 | doze | 33 | graded | 4 | 4 | 4 | 3 | 75 | 2 | 70 | 70 | 0 | 0 | 0 | 0 | – | ok |
| 2026-11-20-foreground-api36 | foreground | 36 | graded | 2 | 2 | 2 | 2 | 100 | 0.5 | 0.8 | 0.8 | 0 | 0 | 0 | 0 | – | over 50 ms |
| 2026-11-20-offline-ttl-expire-api33 | offline-ttl-expire | 33 | graded | 4 | 2 | 1 | 1 | 50 | 2 | 2 | 2 | 1 | 1 | 0 | 1 | – | ok |
| 2026-11-20-permission-denied-api36 | permission-denied | 36 | excluded | 2 | 2 | 0 | 0 | 0 | – | – | – | 0 | 0 | 2 | 0 | permission in device state | ok |

## Lost messages

- 2026-11-20-offline-ttl-expire-api33: s7-b4
