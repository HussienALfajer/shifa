# Spike S7 result: FCM push delivery on Android emulators

Date: 2026-11-19 (probe, sender, analysis on fakes) to 2026-11-20 (emulator runs) · Spec: [0.3-S7](../specs/spikes/0.3-s7-push.md) · Slices: [0.3-S7a](../slices/0.3-s7a-push-probe-and-sender.md), [0.3-S7b](../slices/0.3-s7b-push-runs-and-result.md) · Decision: [ADR-0038](../adr/0038-push-send-policy-device-state-and-inbox.md) (Proposed), amending [ADR-0017](../adr/0017-notifications-push-whatsapp.md) · Checklist: [s7-manual-checklist.md](s7-manual-checklist.md) · Owner decisions: OD-52, OD-54, OD-55 · Raw runs and analysis: `spikes/s7-push/runs/` (`analysis.md`, `analysis.json`)

## Answer
**FCM stays the primary push channel.** On an Android 13 (API 33) emulator with Google Play services, every graded state and the quick one-day run met the OD-52 pass mark: 100% of the pushes that were due were shown within 60 s (slowest 19.6 s, after a reboot), and no message was lost: every send that was not shown was in the inbox. The Doze state passes on its rerun: the first attempt failed and is discounted under OD-54 (below). The states Android blocks (force-stopped, permission denied, channel off) were all detectable by the backend, from the device report or from "last seen".

Three results shape the send policy (ADR-0038):
- **A dozing phone can silently miss pushes when FCM's connection goes stale.** In the first `doze` attempt FCM accepted all 20 sends (`200`), but the first 13 (over about 6 minutes) never reached the device: no notification, no receipt, not even in the 5 minutes after the connection came back on Google Play services' heartbeat reconnect (send 14 showed after 26.8 s, the rest within 0.3 s). The inbox held all 13. The probable cause is the host's VPN reconnecting under a live FCM connection; it was not proven. The rerun showed 20/20 within 0.8 s, and the owner chose to count the rerun (OD-54). The backend cannot see such a drop from FCM's `200`; only a missing receipt shows it.
- **Many pending non-collapsible messages are thrown away.** 120 sends to an offline phone left only the last one shown after reconnect (sent 1.4 s before the network came back); 119 existed only in the inbox. This is consistent with FCM's documented limit of 100 pending messages per device, but no control run below 100 was made, so the threshold itself was not measured. With one `collapse_key` per appointment the same 120 sends ended as 1 message, as designed.
- **Android drops a package's notifications past 50 posted ones**, with no error to the app ("Package has already posted or enqueued 50 notifications"). The spike hit it in two runs. The patient app must cancel stale notifications (a called turn, a past reminder) instead of letting them pile up.

What the emulator cannot answer, and what therefore stays open for real phones in Aleppo and Azaz before the first pilot (OD-52): Syrian mobile networks and their NAT timeouts, OEM battery managers, the newest Android release (OD-54) and a full 08:00–21:00 day with long Doze periods (OD-55).

## Versions tested
- Probe: Flutter 3.47.9 (`.fvmrc`), `firebase_core` 5.2.0, `firebase_messaging` 17.1.0, `flutter_local_notifications` 23.0.3; `compileSdk` 37, debug builds, flavors `compliant` (`dev.shifa.spike.s7push`) and `noshow` (`dev.shifa.spike.s7push.noshow`).
- Sender: Node 24.21, FCM HTTP v1, service account with the single role Firebase Cloud Messaging API Admin; Firebase project chosen by the owner (OD-52), spike apps registered on 2026-11-20.
- Emulators: Android Emulator 37.3.10 on Windows 11 Pro 26200 (Intel Core i9-14900HX, 32 GB); image `system-images;android-33;google_apis_playstore;x86_64` r9, fingerprint `google/sdk_gphone64_x86_64/emu64x:13/TE1A.240213.009/12342917:user/release-keys`, Google Play services 26.45.31, Play Store 30.4.21; two instances (`s7-api33`, `s7-noshow`).
- Not run: the newest API. The API 37.0 (`CE2A.260420.051.A2`) and 36.1 (`BE4B.251210.005`) images boot but SurfaceFlinger aborts in a loop on this emulator (`hasReadColorBufferDma` assertion); the owner deferred the newest release to real phones (OD-54).
- Network: the owner's machine through a VPN, because `dl.google.com` answers 404 to the machine's own network (Google's download block for sanctioned regions). FCM itself worked through the VPN; whether it works without one from Syria was not tested here.

## Evidence per criterion
| # | Result | Proof |
|---|---|---|
| 1 | Channels "مواعيد" (high) and "عام" (default) created at first launch; permission asked only after "book"; token, permission and channel state reported on every open; messages logged with dedupe | 0.3-S7a probe tests; real reports in the runs' `meta.json` (`device`) |
| 2 | Visible high-priority sends with `collapse_key` per appointment, TTL to the appointment, `s7_` label; `UNREGISTERED` marks the install dead | 0.3-S7a sender tests on a fake FCM; every real send answered `200` |
| 3 | Inbox record written before every send; nothing lost in any run | `inbox.jsonl` per run; analysis "Lost messages: None" |
| 4 | State matrix, 20 sends each, table below | `runs/2026-11-20-*-api33` |
| 5 | No sign of deprioritisation in 20 foreground sends the noshow app suppressed, nor in its Doze run. Limits: the sends were visible notification messages, which the noshow flavor suppresses only in the foreground (in the background FCM displays them), and 20 sends over 10 minutes is far shorter than FCM's 7-day window for judging an app | `runs/*-noshow` |
| 6 | 120 pending non-collapsible: only the last shown, 119 inbox only (consistent with the 100 limit, threshold not measured); collapsed: one message | `runs/*pending-limit*` |
| 7 | Quick variant (OD-55): 53 sends 60 s apart with Doze forced between them, 53/53 within 60 s. Full day, newest API and Aggregated Delivery Data: not done (below) | `runs/2026-11-20-day-quick-api33` |
| 8 | Verdict **pass** | `runs/analysis.md`; `analysis/test/runs-commit.test.ts` reproduces it |
| 9 | Battery guide draft below, unverified | sources listed |
| 10 | This report and ADR-0038 | — |

### State matrix (API 33, 20 sends 30 s apart unless noted)
| State | Grading | Shown ≤ 60 s | p95 / max s | Notes |
|---|---|---|---|---|
| foreground | graded | 20/20 | 0.4 / 0.7 | shown by the app itself |
| background | graded | 20/20 | 1.5 / 1.6 | |
| swiped from recents | graded | 20/20 | 0.5 / 0.6 | |
| screen off | graded | 20/20 | 0.7 / 8.8 | |
| Doze forced | graded | 20/20 | 0.4 / 0.8 | rerun; attempt 1 below |
| Doze forced, attempt 1 | recorded (OD-54) | 7/20 | 26.8 / 26.8 | the first 13 never arrived, also not after the reconnect; all in the inbox |
| bucket `rare` | graded | 20/20 | 0.4 / 0.8 | |
| after reboot, app not opened | graded | 20/20 | 1.1 / 19.6 | |
| offline 10 min, long TTL | graded | 1/1 | 1 / 1 | 19 collapsed into the newest |
| offline, TTL expired | graded | 0 due | – | TTL ended 5 min into the 10-min outage: the first 10 sends expired offline, the last 10 went out with TTL `0s`; all 20 in the inbox |
| offline, TTL expired, no collapse | graded | 0 due | – | same |
| slow link (`gsm` speed, `edge` delay) | graded | 20/20 | 0.7 / 1.0 | |
| force-stopped | excluded | 0/20 | 362 max | after the app was opened, queued pushes trickled in about one every 25–30 s: 8 within the 2-minute settle window, 12 not seen before the run ended (inbox only) |
| bucket `restricted` | excluded | 20/20 | 1.4 / 2.1 | high-priority pushes were not held on API 33 |
| permission denied | excluded | 0/20 | – | all in the inbox; `permission=denied` in the device report |
| channel "مواعيد" off | excluded | 1/20 | 0.5 / 0.5 | one shown, likely while the owner was still in the settings page; `appointments=none` in the device report |
| pending limit, 120 non-collapsible | recorded | 1/120 | 1 / 1 | only the last send shown; 119 inbox only |
| pending limit, 120 collapsed | recorded | 1/1 | 0.8 / 0.8 | 119 collapsed |
| noshow app, foreground | recorded | 20/20 received | 0.9 / 14 | not shown by design; the analysis counts the app's foreground receipts as shown |
| noshow app, Doze | recorded | 20/20 | 4.0 / 5.7 | |
| quick day (53 sends, 60 s apart) | graded | 53/53 | 0.8 / 0.9 | two sends went out late (50 s and 21 s) while the runner snoozed old notifications |

Latency is from the send to the notification's post time on the device, moved to the host clock by the measured skew (drift under 50 ms in every run except the reboot, 936 ms, which the reboot explains). For a send made while offline it starts when the network came back.

## Answers to the spec's questions

### Does a visible high-priority push reach a dozing or idle phone within 60 s, and which states lose it?
Yes, on this emulator, in Doze, the `rare` and even the `restricted` bucket, screen off, after a reboot, on a slow link and after being swiped away. Nothing was lost in any state, because every send had an inbox record first. Not shown: force-stopped (until the app is opened), permission denied, channel off, sends whose TTL ended while offline, and non-collapsible sends piled up offline (120 left one). Once, a stale FCM connection lost 13 pushes that FCM had accepted (the first `doze` attempt); Android gives the app no signal for it, and only the inbox kept them.

### What must the backend know to fall back in time?
- **Per device, reported on every app open:** FCM token, notification permission, the "مواعيد" channel's importance, app version, SDK level and a "last seen" time. Permission denied and channel off show directly in this report; a force-stopped app runs no code until opened, so only a stale "last seen" reveals it. (The `restricted` bucket did not stop delivery on API 33, but newer releases and OEMs may differ.)
- **Per message:** whether the app received it (a receipt from the app when it runs) and whether the patient opened it. FCM's `200` only means FCM accepted it.
- **Rule:** a time-critical message (turn near, called) that has no receipt after a short window, or goes to a device whose report says denied/off or whose last-seen is old, takes the next channel of MSG-01 at once. ADR-0038 sets the starting values; the pilot tunes them.

### Do collapse keys and TTL keep an offline phone from a pile of stale reminders?
Yes. One `collapse_key` per appointment left one message, the newest, after 10 minutes offline; a TTL that ends at the appointment dropped every reminder that would have arrived late. Collapse also keeps a phone below FCM's 100 pending messages: without it, 120 sends left only the last shown and FCM gave the app no list of what it dropped (`onDeletedMessages` is not exposed by the Flutter plugin), so the inbox must be fetched on every open.

### What remains to check on real phones in Aleppo and Azaz before the pilot?
- FCM over Syrian mobile networks without a VPN, and how often their NAT drops the idle connection (the heartbeat reconnect seen once here).
- A full 08:00–21:00 day with real Doze maintenance windows (OD-55), and the newest Android release (OD-54).
- Each OEM's battery manager with and without the guide below, on Samsung, Xiaomi/Redmi/POCO, Oppo/Realme, Tecno/Infinix; Huawei phones without Google services cannot receive FCM at all (MSG-31).
- FCM Aggregated Delivery Data for the `s7_` labels (criterion 7): it lags up to 5 days and is pulled with the owner's own login; not pulled before this report closed.
- The pending-limit threshold, with a control run below 100 messages.
- The 50-notifications cap with the real app's notification lifecycle.

## Battery guide draft (MSG-28, PAT-30; unverified until the real-phone run)
The guide is Arabic product text for the patient app; menu names are given in English as the phones show them in the English UI, because official Arabic labels were found only for Samsung (on an older page). Every path is **unverified** until the real-phone run (OD-52): most public sources are undated and do not cover One UI 7/8, HyperOS or ColorOS 14/15. Sources were read on 2026-11-20.

**كل الهواتف (Android 13 وما بعده)**
1. اسمح لتطبيق شفاء بالإشعارات عندما يطلب ذلك، وتأكد أن قناة «مواعيد» مفعّلة.
2. الإعدادات ← التطبيقات ← شفاء ← البطارية ← اختر «غير مقيّد» (Unrestricted).

**Samsung**
1. الإعدادات ← العناية بالبطارية والجهاز ← البطارية ← إدارة طاقة التطبيقات (App power management) ← التطبيقات التي لا تدخل وضع السكون أبداً (Never sleeping apps) ← أضف شفاء.
2. في الشاشة نفسها أطفئ «وضع التطبيقات غير المستخدمة في السكون تلقائياً».
3. الإعدادات ← التطبيقات ← شفاء ← البطارية ← غير مقيّد.

**Xiaomi / Redmi / POCO**
1. الإعدادات ← التطبيقات ← شفاء ← أذونات التطبيق ← فعّل التشغيل التلقائي في الخلفية (Autostart).
2. موفّر البطارية للتطبيق (Battery saver) ← بلا قيود (No restrictions).
3. في قائمة التطبيقات الأخيرة اضغط مطولاً على شفاء واقفله.

**Oppo / Realme**
1. الإعدادات ← إدارة التطبيقات ← شفاء ← استخدام البطارية ← فعّل «السماح بالنشاط في الخلفية» والتشغيل التلقائي (Auto launch).
2. في Realme: الإعدادات ← البطارية ← إدارة بطارية التطبيقات، وأطفئ «تحسين الاستعداد أثناء النوم» (Sleep standby optimization).
3. اقفل شفاء في قائمة التطبيقات الأخيرة.

**Tecno / Infinix**
1. الإعدادات ← Battery Lab ← إعدادات توفير البطارية ← أطفئ «إدارة توفير الطاقة للتطبيقات» لشفاء.
2. Phone Master (في Infinix: XManager) ← إدارة التشغيل التلقائي ← اسمح لشفاء.
3. اقفل شفاء في قائمة التطبيقات الأخيرة.

**Huawei**
- الهواتف التي لا تحوي خدمات Google لا تستقبل إشعارات FCM أبداً؛ تصلها الرسائل عبر صندوق الإشعارات وواتساب (MSG-31).
- الهواتف التي تحوي خدمات Google: الإعدادات ← البطارية ← تشغيل التطبيقات (App launch) ← شفاء ← أطفئ «الإدارة التلقائية» وفعّل التشغيل التلقائي والتشغيل الثانوي والتشغيل في الخلفية.

Sources (read 2026-11-20):
- Android: [notification permission](https://developer.android.com/develop/ui/views/notifications/notification-permission), [app standby buckets](https://developer.android.com/topic/performance/appstandby), [Doze and standby](https://developer.android.com/training/monitoring-device-state/doze-standby), [background optimisation](https://developer.android.com/topic/performance/background-optimization) (undated).
- Samsung: [sleeping apps support page](https://www.samsung.com/ae/support/mobile-devices/how-to-manage-sleeping-apps-to-save-battery-life-on-your-galaxy-device/) (updated 2026-06-22); Arabic labels from samsung.com/ae_ar (2023-03-31, older One UI); [dontkillmyapp Samsung](https://dontkillmyapp.com/samsung) (last note 07/2024).
- Xiaomi: [dontkillmyapp Xiaomi](https://dontkillmyapp.com/xiaomi) (undated, MIUI 10–14; HyperOS not covered).
- Oppo/Realme: [dontkillmyapp Oppo](https://dontkillmyapp.com/oppo), [dontkillmyapp Realme](https://dontkillmyapp.com/realme) (undated); [techbone ColorOS](https://www.techbone.net/oppo/smartphone/background-activity) (unofficial, 2026-08-03).
- Tecno/Infinix: [dontkillmyapp Tecno](https://dontkillmyapp.com/tecno) (undated); no Infinix page (404); the XManager path is from search results only.
- Huawei: [dontkillmyapp Huawei](https://dontkillmyapp.com/huawei) (undated, EMUI); FCM needs Google Play on the device ([Firebase Android client](https://firebase.google.com/docs/cloud-messaging/android/client)).

## Deviations from the spec
- **Newest API not run** (criteria 4 and 7): the API 37.0 and 36.1 images crash SurfaceFlinger on emulator 37.3.10; deferred to real phones (OD-54).
- **One-day run in its quick form** (criterion 7): 53 sends 60 s apart instead of 15 minutes from 08:00 to 21:00, by the owner's choice (OD-55). It cannot show long Doze periods.
- **Aggregated Delivery Data not pulled** (criterion 7): it lags up to 5 days; the owner pulls it with `gcloud` after the merge and the result is added to this report.
- **Doze attempt 1** failed (13 of 20 accepted pushes never arrived), most likely because the host's VPN reconnected under a live FCM connection; not proven. The owner chose to count the rerun (OD-54); both are committed.
- **Network type and country** (criterion 7): only "the owner's machine through a VPN" is recorded; the owner still has to state the line type and the VPN's exit country.
- **Spike-code limits found in review** (not fixed, no effect on the committed result): the pass rule does not check that every state and a day run are present; missed day slots are printed but not saved in `meta.json`; the reboot run uses the mean of the pre- and post-reboot skew (its latencies read about 0.5 s high); a run's device snapshot is the latest report, so runs after `channel-off` carry its `appointments=none` until the app is opened again; an expired or collapsed send missing from the inbox would not count as lost.
- **Two runs discarded** (`swiped`, `screen-off` first attempts) because the probe's 50 earlier notifications hid new ones; fixed by snoozing old notifications before each run (`clearTray`), then rerun.
- **Analysis fix:** a graded run where every send expired offline counted as 0%; nothing was due, so it now counts as 100% (`analysis/test/join.test.ts`).

## Clean-up
The owner removes both spike Android apps from the Firebase project and deletes the `s7-push-sender` service account and its key file after the report is accepted; the date is recorded in the slice file.
