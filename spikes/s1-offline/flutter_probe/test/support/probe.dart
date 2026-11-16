// Shared setup of the probe tests: the launcher's stack (passed as --dart-define), Toxiproxy cuts
// ("airplane mode"), a reception view for checks the device cannot make, and polling helpers.
// Run through `pnpm --filter @shifa-spike/s1-scenarios probe`, never on its own.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/key_store.dart';

const _engine = String.fromEnvironment('S1_ENGINE');
const _serverUrl = String.fromEnvironment('S1_SERVER_URL');
const _powersyncUrl = String.fromEnvironment('S1_POWERSYNC_URL');
const _toxiApi = String.fromEnvironment('S1_TOXI_API');
const _directUrl = String.fromEnvironment('S1_DIRECT_URL');
const _patientId = String.fromEnvironment('S1_PATIENT_ID');
const _otherAppointmentId = String.fromEnvironment('S1_OTHER_APPOINTMENT_ID');
const _otherTicketId = String.fromEnvironment('S1_OTHER_TICKET_ID');
const _deviceId = String.fromEnvironment('S1_DEVICE_ID');
const _proxy = String.fromEnvironment('S1_PROXY');

/// The number of today's appointments the launcher seeds for the patient.
const seededAppointments = 2;

class Probe {
  new _();

  static void requireStack() {
    for (final (name, value) in [
      ('S1_ENGINE', _engine),
      ('S1_SERVER_URL', _serverUrl),
      ('S1_TOXI_API', _toxiApi),
      ('S1_DIRECT_URL', _directUrl),
      ('S1_PATIENT_ID', _patientId),
      ('S1_OTHER_APPOINTMENT_ID', _otherAppointmentId),
      ('S1_OTHER_TICKET_ID', _otherTicketId),
      ('S1_DEVICE_ID', _deviceId),
      ('S1_PROXY', _proxy),
    ]) {
      if (value.isEmpty) {
        throw StateError('$name missing: run through the probe launcher');
      }
    }
  }

  static String get engine => _engine;
  static String get deviceId => _deviceId;
  static String get otherAppointmentId => _otherAppointmentId;
  static String get otherTicketId => _otherTicketId;

  static ProbeEngine newEngine(Directory dir, KeyStore keys) => createEngine(
    _engine,
    ProbeConfig(
      serverUrl: Uri.parse(_serverUrl),
      powersyncUrl: _powersyncUrl.isEmpty ? null : Uri.parse(_powersyncUrl),
      deviceId: _deviceId,
      directory: dir.path,
      keys: keys,
    ),
  );

  /// Logs the patient in through the device's (proxied) link.
  static Future<String> login() =>
      patientLogin(Uri.parse(_serverUrl), _patientId, _deviceId);

  static Future<void> _proxies({required bool enabled}) async {
    for (final name in [_proxy, '$_proxy-ps']) {
      final res = await http.post(
        Uri.parse('$_toxiApi/proxies/$name'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'enabled': enabled}),
      );
      if (res.statusCode >= 300 && res.statusCode != 404) {
        throw StateError('toxiproxy $name: ${res.statusCode}');
      }
    }
  }

  /// Airplane mode: the device's API link and (PowerSync) sync-stream link go down.
  static Future<void> cut() => _proxies(enabled: false);
  static Future<void> restore() => _proxies(enabled: true);

  static Future<String> _receptionToken() async {
    final res = await http.post(
      Uri.parse('$_directUrl/auth/login'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'username': 'reception-a'}),
    );
    return (jsonDecode(res.body) as Map<String, dynamic>)['token'] as String;
  }

  /// Today's appointments of the branch as the server has them (id → status).
  static Future<Map<String, String>> serverAppointments() async {
    final res = await http.get(
      Uri.parse('$_directUrl/sync/pull'),
      headers: {'authorization': 'Bearer ${await _receptionToken()}'},
    );
    final rows =
        ((jsonDecode(res.body) as Map<String, dynamic>)['rows']
                as Map<String, dynamic>)['appointment']
            as List<dynamic>;
    return {
      for (final r in rows.cast<Map<String, dynamic>>())
        r['id'] as String: r['status'] as String,
    };
  }

  /// The server's counts for this device: commands, applied, conflict, refused.
  static Future<Map<String, dynamic>> report() async {
    final res = await http.get(
      Uri.parse('$_directUrl/report?devices=$_deviceId'),
      headers: {'authorization': 'Bearer ${await _receptionToken()}'},
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (body['byDevice'] as Map<String, dynamic>)[_deviceId]
        as Map<String, dynamic>;
  }
}

/// A fresh directory for one test's database files.
Directory tempStore() => Directory.systemTemp.createTempSync('s1-probe-');

/// The first value of [stream] that satisfies [test], or a timeout.
Future<T> firstWhere<T>(
  Stream<T> stream,
  bool Function(T) test, {
  Duration timeout = const Duration(seconds: 60),
}) => stream.firstWhere(test).timeout(timeout);

/// Polls [check] (after one [ProbeEngine.syncNow]) until it holds, or fails after [timeout].
Future<void> eventually(
  ProbeEngine engine,
  Future<bool> Function() check, {
  Duration timeout = const Duration(seconds: 90),
  String reason = 'condition',
}) async {
  final until = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(until)) {
    await engine.syncNow();
    if (await check()) return;
    await Future<void>.delayed(const Duration(milliseconds: 500));
  }
  throw TimeoutException('$reason not reached', timeout);
}

/// Files of a database: the main file and its journal companions.
List<File> databaseFiles(String path) => [
  for (final suffix in ['', '-wal', '-shm', '-journal']) File('$path$suffix'),
];
