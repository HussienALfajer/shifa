// PowerSync connector: credentials are the patient's spike token (no refresh
// in the probe); uploads go to POST /powersync/upload, the same command
// handler as the outbox engine. A network error throws so PowerSync retries
// the same batch; a 401 keeps the queue and reports needs-login.
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:powersync/powersync.dart';

class PsConnector extends PowerSyncBackendConnector {
  new({
    required this.serverUrl,
    required this.powersyncUrl,
    required this.token,
  });

  final Uri serverUrl;
  final Uri powersyncUrl;
  final String token;
  final http.Client _http = http.Client();

  /// Set when the server refused the token; nothing syncs until a new login.
  bool needsLogin = false;

  @override
  Future<PowerSyncCredentials?> fetchCredentials() async => needsLogin
      ? null
      : PowerSyncCredentials(endpoint: '$powersyncUrl', token: token);

  @override
  Future<void> uploadData(PowerSyncDatabase database) async {
    final batch = await database.getCrudBatch(limit: 200);
    if (batch == null || needsLogin) return;
    final res = await _http
        .post(
          serverUrl.resolve('/powersync/upload'),
          headers: {
            'authorization': 'Bearer $token',
            'content-type': 'application/json',
          },
          body: jsonEncode({
            'batch': [
              for (final e in batch.crud)
                {
                  'op': e.op.toJson(),
                  'type': e.table,
                  'id': e.id,
                  'data': e.opData,
                },
            ],
          }),
        )
        .timeout(const Duration(seconds: 10));
    if (res.statusCode == 401) {
      needsLogin = true;
      throw StateError('needs login');
    }
    if (res.statusCode != 200) throw StateError('upload ${res.statusCode}');
    await batch.complete();
  }

  void close() => _http.close();
}
