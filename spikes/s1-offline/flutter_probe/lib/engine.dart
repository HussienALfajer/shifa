// The probe's engine interface: what the patient screen and the tests need from either sync
// engine (custom outbox or PowerSync). Rows are synthetic; nothing here is ever logged.
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:s1_flutter_probe/key_store.dart';
import 'package:s1_flutter_probe/outbox/outbox_engine.dart';

enum ProbeStatus { online, offline, needsLogin }

class Appointment {
  const new({required this.id, required this.startsAt, required this.status});

  final String id;
  final String startsAt;
  final String status;

  bool get cancelled => status == 'cancelled';
}

class Ticket {
  const new({
    required this.id,
    required this.number,
    required this.status,
    required this.label,
  });

  final String id;
  final int number;
  final String status;
  final String label;
}

/// Where an engine keeps its store and which services it talks to.
class ProbeConfig {
  const new({
    required this.serverUrl,
    required this.deviceId,
    required this.directory,
    required this.keys,
    this.powersyncUrl,
  });

  /// The spike server (pull, commands, uploads).
  final Uri serverUrl;

  /// The PowerSync service (download stream); PowerSync engine only.
  final Uri? powersyncUrl;
  final String deviceId;

  /// Directory of the local database files.
  final String directory;
  final KeyStore keys;
}

abstract interface class ProbeEngine {
  /// The main database file (its `-wal`/`-shm` files sit next to it).
  String get databasePath;

  /// Opens (or creates) the encrypted store and starts syncing as the token's patient.
  Future<void> open(String token);

  /// The patient's cached appointments, re-emitted on every local change.
  Stream<List<Appointment>> appointments();

  /// The patient's ticket of today, if any.
  Stream<Ticket?> ticket();

  /// Cancels locally at once and queues `appointment.cancel` with a client UUID.
  Future<void> cancel(String appointmentId);

  /// Commands not yet accepted by the server.
  Future<int> pendingCount();

  /// One sync attempt now (outbox: flush then pull; PowerSync: a short wait).
  Future<void> syncNow();

  ProbeStatus get status;

  /// Stops syncing and closes the store (the data and key stay).
  Future<void> close();

  /// Closes, deletes the database files and deletes the key.
  Future<void> logout();
}

/// Engine names accepted by [createEngine] (stubs exist for the red proof only).
const engineNames = ['outbox', 'powersync', 'stub-plain', 'stub-drop'];

ProbeEngine createEngine(String name, ProbeConfig config) => switch (name) {
  'outbox' => OutboxEngine(config),
  'stub-plain' => OutboxEngine(config, encrypt: false),
  'stub-drop' => OutboxEngine(config, keepQueue: false),
  _ => throw ArgumentError.value(name, 'engine'),
};

/// Spike login for a synthetic patient; the device id is bound into the token.
Future<String> patientLogin(
  Uri server,
  String patientId,
  String deviceId, {
  http.Client? client,
}) async {
  final c = client ?? http.Client();
  try {
    final res = await c.post(
      server.resolve('/auth/patient-login'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'patientId': patientId, 'deviceId': deviceId}),
    );
    if (res.statusCode != 200) {
      throw StateError('patient login failed: ${res.statusCode}');
    }
    return (jsonDecode(res.body) as Map<String, dynamic>)['token'] as String;
  } finally {
    if (client == null) c.close();
  }
}
