// Every Firebase call sits behind `PushClient`, so tests and `flutter analyze` run without
// Firebase or a google-services.json; `FirebasePushClient` is the real one.
import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';

enum PushPermission {
  notDetermined,
  granted,
  denied,
  provisional;

  /// The name the receiver stores.
  String get wire => name;
}

/// A received message: the sender puts `s7id`, `sentAt`, `appointmentId` and `kind` in data.
class PushMessage {
  new({required this.data, this.messageId, this.title, this.body});

  final String? messageId;
  final Map<String, String> data;
  final String? title;
  final String? body;

  String? get s7id => data['s7id'];
  String get kind => data['kind'] ?? 'unknown';

  /// FCM does not deliver the analytics label to the device; the sender's rule is `s7_<kind>`.
  String get label => 's7_$kind';
}

abstract interface class PushClient {
  Future<String?> getToken();
  Stream<String> get onTokenRefresh;

  /// The current notification permission, without asking.
  Future<PushPermission> permission();

  /// Asks the user (Android 13+: POST_NOTIFICATIONS); older Android answers granted.
  Future<PushPermission> requestPermission();

  /// Messages while the app is in the foreground (FCM does not show these itself).
  Stream<PushMessage> get onForeground;

  /// A notification tapped from the tray while the app was in the background.
  Stream<PushMessage> get onOpened;

  /// The notification that launched the app from terminated, if any.
  Future<PushMessage?> initialMessage();
}

PushMessage fromRemote(RemoteMessage m) => PushMessage(
  messageId: m.messageId,
  title: m.notification?.title,
  body: m.notification?.body,
  data: {for (final e in m.data.entries) e.key: '${e.value}'},
);

PushPermission _map(AuthorizationStatus s) => switch (s) {
  AuthorizationStatus.authorized => PushPermission.granted,
  AuthorizationStatus.denied ||
  AuthorizationStatus.deniedPermanently => PushPermission.denied,
  AuthorizationStatus.provisional => PushPermission.provisional,
  AuthorizationStatus.notDetermined => PushPermission.notDetermined,
};

class FirebasePushClient implements PushClient {
  new([FirebaseMessaging? messaging])
    : _m = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _m;

  // FCM HTTP v1 sends to the registration token (`message.token`), which getToken and
  // onTokenRefresh still return; firebase_messaging 17 deprecates them in favour of the
  // Installation-ID (FID) direct-send path, which the spike does not test (0.3-S7b report).
  @override
  // Deprecated in firebase_messaging 17; still the HTTP v1 send target (see above).
  // ignore: deprecated_member_use
  Future<String?> getToken() => _m.getToken();

  @override
  // Deprecated in firebase_messaging 17; still how a rotated registration token arrives.
  // ignore: deprecated_member_use
  Stream<String> get onTokenRefresh => _m.onTokenRefresh;

  @override
  Future<PushPermission> permission() async =>
      _map((await _m.getNotificationSettings()).authorizationStatus);

  @override
  Future<PushPermission> requestPermission() async =>
      _map((await _m.requestPermission()).authorizationStatus);

  @override
  Stream<PushMessage> get onForeground =>
      FirebaseMessaging.onMessage.map(fromRemote);

  @override
  Stream<PushMessage> get onOpened =>
      FirebaseMessaging.onMessageOpenedApp.map(fromRemote);

  @override
  Future<PushMessage?> initialMessage() async {
    final m = await _m.getInitialMessage();
    return m == null ? null : fromRemote(m);
  }
}
