// Test doubles for the probe: a fake push client (no Firebase), a fake channel platform (no
// Android) and a fake receiver behind package:http's MockClient that can go offline.
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:s7_push_probe/channels.dart';
import 'package:s7_push_probe/push_client.dart';

class FakePushClient implements PushClient {
  new({this.token = 'fake-token-1', this.answer = PushPermission.granted});

  String? token;
  PushPermission current = PushPermission.notDetermined;

  /// What the user answers when asked.
  PushPermission answer;
  int requestCount = 0;
  final tokenRefresh = StreamController<String>.broadcast();
  final foreground = StreamController<PushMessage>.broadcast();
  final opened = StreamController<PushMessage>.broadcast();
  PushMessage? initial;

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => tokenRefresh.stream;

  @override
  Future<PushPermission> permission() async => current;

  @override
  Future<PushPermission> requestPermission() async {
    requestCount += 1;
    current = answer;
    return answer;
  }

  @override
  Stream<PushMessage> get onForeground => foreground.stream;

  @override
  Stream<PushMessage> get onOpened => opened.stream;

  @override
  Future<PushMessage?> initialMessage() async => initial;
}

class FakeChannelPlatform implements ChannelPlatform {
  final Map<String, ChannelSpec> channels = {};
  final List<ChannelSpec> created = [];
  final List<(String, PushMessage)> shown = [];

  @override
  Future<Map<String, String>> importances() async => {
    for (final c in channels.values) c.id: c.importance.wire,
  };

  @override
  Future<void> create(ChannelSpec spec) async {
    created.add(spec);
    channels[spec.id] = spec;
  }

  @override
  Future<void> show(PushMessage message, String channelId) async {
    shown.add((channelId, message));
  }
}

/// A recorded request to the fake receiver.
typedef Sent = ({
  String method,
  String path,
  Map<String, String> query,
  Object? body,
});

class FakeReceiver {
  bool online = true;
  final List<Sent> requests = [];
  List<Map<String, Object?>> inbox = [];
  int serverNowMs = 1_800_000_000_000;

  late final http.Client client = MockClient((request) async {
    if (!online) throw http.ClientException('offline', request.url);
    final body = request.body.isEmpty ? null : jsonDecode(request.body);
    requests.add((
      method: request.method,
      path: request.url.path,
      query: request.url.queryParameters,
      body: body,
    ));
    return switch (request.url.path) {
      '/devices' || '/receipts' => http.Response('', 204),
      '/inbox' => _json({'items': inbox}),
      '/time' => _json({'now': serverNowMs}),
      '/queue' => _json({'ahead': 3, 'text': 'دورك بعد ٣'}),
      _ => http.Response('not found', 404),
    };
  });

  List<Sent> to(String path) => requests.where((r) => r.path == path).toList();

  static http.Response _json(Object body) => http.Response(
    jsonEncode(body),
    200,
    headers: {'content-type': 'application/json; charset=utf-8'},
  );
}

PushMessage message(String s7id, {String kind = 'reminder', String? fcmId}) =>
    PushMessage(
      messageId: fcmId ?? '0:$s7id',
      title: 'تذكير بموعدك',
      body: 'موعدك في عيادة تجريبية',
      data: {
        's7id': s7id,
        'sentAt': '2026-11-19T08:00:00.000Z',
        'appointmentId': 'appt-1',
        'kind': kind,
      },
    );

Map<String, Object?> inboxItem(String s7id) => {
  's7id': s7id,
  'installId': 'install-1',
  'appointmentId': 'appt-1',
  'kind': 'reminder',
  'title': 'تذكير بموعدك',
  'body': 'موعدك في عيادة تجريبية',
  'createdAt': '2026-11-19T08:00:00.000Z',
};
