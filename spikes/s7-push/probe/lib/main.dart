// Entry point of the push probe (spike 0.3-S7). Needs the owner's untracked
// android/app/google-services.json at build time. Receiver URL: --dart-define=S7_RECEIVER=...
// (default http://10.0.2.2:8787, the host's 127.0.0.1 seen from the emulator).
// Flavors: `compliant` (dev.shifa.spike.s7push) and `noshow` (….noshow, criterion 5).
import 'dart:async';
import 'dart:convert';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:s7_push_probe/app.dart';
import 'package:s7_push_probe/channels.dart';
import 'package:s7_push_probe/clock.dart';
import 'package:s7_push_probe/device_state.dart';
import 'package:s7_push_probe/message_log.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

const appVersion = '0.0.1';
final Uri receiverUrl = checkedReceiverUrl(
  const String.fromEnvironment(
    'S7_RECEIVER',
    defaultValue: 'http://10.0.2.2:8787',
  ),
);

/// The probe posts its full FCM token: plain HTTP only to the host machine (the emulator's
/// 10.0.2.2, or loopback through `adb reverse`), HTTPS anywhere else. Android's network security
/// config does not limit dart:io, so the check lives here.
Uri checkedReceiverUrl(String value) {
  final url = Uri.parse(value);
  const local = {'10.0.2.2', '127.0.0.1', 'localhost'};
  if (url.scheme == 'https' ||
      (url.scheme == 'http' && local.contains(url.host))) {
    return url;
  }
  throw ArgumentError.value(
    value,
    'S7_RECEIVER',
    'must be https, or http to 10.0.2.2 / 127.0.0.1',
  );
}

const _settings = MethodChannel('dev.shifa.spike.s7push/settings');

Future<FileStore> _store() async =>
    FileStore(await getApplicationDocumentsDirectory());

/// Runs in its own isolate for messages that arrive while the app is not in the foreground.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  final store = await _store();
  final clockJson = await store.read(clockFile);
  final clock = clockJson == null
      ? const ClockOffset()
      : ClockOffset(
          offsetMs:
              (jsonDecode(clockJson) as Map<String, Object?>)['offsetMs']
                  as int?,
        );
  final api = ReceiverApi(receiverUrl);
  await MessageLog(
    store: store,
    api: api,
    outbox: Outbox(store),
    installId: await installIdFor(store),
    clock: clock,
  ).record(fromRemote(message), appState: 'background', path: 'background');
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  final channels = LocalNotificationsPlatform();
  await channels.initialize();
  final android = await DeviceInfoPlugin().androidInfo;
  runApp(
    ProbeApp(
      services: ProbeServices(
        push: FirebasePushClient(),
        channels: channels,
        store: await _store(),
        receiverUrl: receiverUrl,
        deviceInfo: DeviceInfo(
          appVersion: '$appVersion+${appFlavor ?? 'compliant'}',
          sdkInt: android.version.sdkInt,
          model: android.model,
        ),
        openSettings: () =>
            _settings.invokeMethod<void>('openNotificationSettings'),
        // The noshow flavor (criterion 5) logs foreground messages without showing them.
        // `appFlavor` is a per-build constant, so the analyzer sees this as the default.
        // ignore: avoid_redundant_argument_values
        showForeground: appFlavor != 'noshow',
      ),
    ),
  );
}
