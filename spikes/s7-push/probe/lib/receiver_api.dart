// HTTP client for the spike receiver (spikes/s7-push/receiver). The emulator reaches the host's
// 127.0.0.1 at 10.0.2.2. Any failure (offline, non-2xx) throws, so callers can queue and retry.
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:s7_push_probe/inbox.dart';

class ReceiverException implements Exception {
  new(this.status, this.path);

  final int status;
  final String path;

  @override
  String toString() => 'receiver answered $status on $path';
}

class ReceiverApi {
  new(this.baseUrl, {http.Client? client}) : _client = client ?? http.Client();

  final Uri baseUrl;
  final http.Client _client;
  static const _timeout = Duration(seconds: 10);

  Uri _uri(String path, [Map<String, String>? query]) =>
      baseUrl.replace(path: path, queryParameters: query);

  Future<void> _post(String path, Map<String, Object?> body) async {
    final res = await _client
        .post(
          _uri(path),
          headers: {'content-type': 'application/json'},
          body: jsonEncode(body),
        )
        .timeout(_timeout);
    if (res.statusCode >= 300) throw ReceiverException(res.statusCode, path);
  }

  Future<Map<String, Object?>> _get(
    String path, [
    Map<String, String>? query,
  ]) async {
    final res = await _client.get(_uri(path, query)).timeout(_timeout);
    if (res.statusCode >= 300) throw ReceiverException(res.statusCode, path);
    return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, Object?>;
  }

  Future<void> postDevice(Map<String, Object?> body) => _post('/devices', body);

  Future<void> postReceipt(Map<String, Object?> body) =>
      _post('/receipts', body);

  /// Posts a queued outbox entry by its kind.
  Future<void> post(String kind, Map<String, Object?> body) =>
      kind == 'device' ? postDevice(body) : postReceipt(body);

  Future<List<InboxItem>> inbox(String installId, {String? since}) async {
    final json = await _get('/inbox', {
      'installId': installId,
      'since': ?since,
    });
    return [
      for (final item in json['items']! as List<Object?>)
        InboxItem.fromJson(item! as Map<String, Object?>),
    ];
  }

  /// The receiver's clock in epoch milliseconds.
  Future<int> time() async => (await _get('/time'))['now']! as int;

  /// The synthetic live-queue line ("دورك بعد ٣"), polled with the inbox (MSG-30).
  Future<String> queue(String installId) async =>
      (await _get('/queue', {'installId': installId}))['text']! as String;
}
