# Spike 0.3-S1 — manual offline run (owner checklist)

Criterion 12 of [spec 0.3-S1](../specs/spikes/0.3-s1-offline-sync.md): two real devices on a clinic-like LAN, Wi-Fi off for 2 real hours, the scripted actions of criterion 6 by hand, the browser restarted and the laptop put to sleep once in between. Run it once per engine. Synthetic data only: type made-up names such as "مراجع 1".

## Setup (once per engine)
Run it only on a network you control (home or office router), never on a real clinic network: the spike has no passwords, and Docker publishes the test containers' ports on every interface (allow only port 4310, and for PowerSync the printed sync port, through the laptop's firewall).

1. On the server laptop (Docker running), from the repository root (Git Bash):
   - outbox: `ENGINE=outbox pnpm --filter @shifa-spike/s1-scenarios serve`
   - PowerSync: the same with `ENGINE=powersync`.
   It prints the laptop's LAN address(es) (`http://<laptop-ip>:4310`); open the same address on both devices. Keep it running for the whole test. The devices must reach the laptop over the LAN (same Wi-Fi router, firewall allowing port 4310).
   - The prototype needs a secure context (service worker, PowerSync's database). Over plain HTTP on the LAN, start Chrome on each device with `--unsafely-treat-insecure-origin-as-secure=http://<laptop-ip>:4310` (for PowerSync, add the printed `:<port>` of the sync service too, comma-separated) and a fresh `--user-data-dir`, or open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` and add the same origins. Synthetic data only, so this is acceptable for the test.
2. On each of the two devices (laptop or tablet with Chrome or Edge), open the printed address, log in as **استقبال — عيادة أ**, wait for the banner to say **متصل**.
3. On device 1 open the cash session (**فتح الصندوق**); on device 2 wait until the cash form appears.

## The outage (2 real hours)
4. Note the time, then turn Wi-Fi off on **both** devices. Check that the banner turns yellow (**دون اتصال**) and its timer runs.
5. Over the 2 hours, split roughly evenly between the devices:
   - 40 walk-ins (20 each); print or photograph one ticket per device (provisional number and device id visible);
   - 60 status changes (نودي / انتهى on the tickets you created);
   - 50 sales spread over SYP, TRY and USD; 5 refunds of 1.00 from an SYP sale;
   - on both devices book the **same doctor at the same time** (the double booking).
6. Once, about halfway: close the browser completely on device 1 and reopen the address (still offline). Check that the app opens and **بانتظار المزامنة** shows the same number as before.
7. Once: close the lid of device 2 (sleep) for 5 minutes, then open it. Check the queue is still there.
8. Write down on each device the pending count shown in the banner just before reconnecting.

## Reconnect
9. Turn Wi-Fi on for both devices. Within a minute the banner should turn green, the pending count reach 0, and the **تغييرات الأرقام والتعارضات** list show every number change and one conflict for the double booking.
10. In the server laptop's terminal press **Enter**: it prints the counts-only report for both devices (device ids are in each device's page title line "الجهاز dev-…"). Copy the counts into the table below.

## Results (fill in per engine)

| Check | Expected | Outbox | PowerSync |
|---|---|---|---|
| Commands on the server (both devices) | = actions done (≈157 + 1 cash open) | | |
| Tickets / duplicate real numbers / gaps | 40 / 0 / 0 | | |
| Cash movements | 55 | | |
| Cash totals SYP / TRY / USD | sum of your entries | | |
| Number changes shown on each device | = report `remaps` per device | | |
| Double booking shown as a conflict | 1 | | |
| Pending count after reconnect | 0 on both | | |
| App opened after browser restart offline | yes | | |
| Queue intact after sleep | yes | | |
| Anything odd (time it took, error messages) | — | | |

Signed (owner): ______________________  Date: __________
