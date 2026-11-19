// Device-state report (criterion 1, PAT-21): on every open and token refresh the probe posts its
// install id, FCM token, permission and channel importance, so the backend can tell a reachable
// device from one that needs another channel. The full token goes only to the local receiver;
// anything written for people shows the short hash.
import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:s7_push_probe/channels.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

const installIdKey = 'install_id';

class DeviceInfo {
  const new({
    required this.appVersion,
    required this.sdkInt,
    required this.model,
  });

  final String appVersion;
  final int sdkInt;
  final String model;
}

/// First 12 hex characters of the token's SHA-256.
String tokenHash(String token) =>
    sha256.convert(utf8.encode(token)).toString().substring(0, 12);

/// A random id kept in app storage: new on reinstall, stable across opens.
Future<String> installIdFor(ProbeStore store) async {
  final existing = await store.read(installIdKey);
  if (existing != null && existing.isNotEmpty) return existing;
  final random = Random.secure();
  final id = [
    for (var i = 0; i < 16; i++)
      random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ].join();
  await store.write(installIdKey, id);
  return id;
}

class DeviceStateReporter {
  new({
    required this.push,
    required this.channels,
    required this.api,
    required this.outbox,
    required this.installId,
    required this.info,
  });

  final PushClient push;
  final ChannelPlatform channels;
  final ReceiverApi api;
  final Outbox outbox;
  final String installId;
  final DeviceInfo info;

  Future<Map<String, Object?>> snapshot() async {
    final token = await push.getToken() ?? '';
    return {
      'installId': installId,
      'tokenHash': token.isEmpty ? 'none' : tokenHash(token),
      'token': token.isEmpty ? 'none' : token,
      'permission': (await push.permission()).wire,
      'channels': await channelState(channels),
      'appVersion': info.appVersion,
      'sdkInt': info.sdkInt,
      'model': info.model,
    };
  }

  /// Posts the current state; when offline, queues it. Returns whether it reached the receiver.
  Future<bool> report() async {
    final body = await snapshot();
    try {
      await outbox.flush(api);
      await api.postDevice(body);
      return true;
    } on Exception {
      await outbox.add('device', body);
      return false;
    }
  }

  /// Reports again on every token refresh. Cancel the subscription on dispose.
  StreamSubscription<String> start() =>
      push.onTokenRefresh.listen((_) => unawaited(report()));
}
