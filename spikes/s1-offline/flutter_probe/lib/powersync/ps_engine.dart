// PowerSync engine (ADR-0014 option a) for the patient app: the PowerSync
// SDK on the same SQLCipher build and key form as the outbox engine, reads
// through drift (drift_sqlite_async over the PowerSync connection). A cancel
// writes a local-only overlay row and an insert-only `outbox_command` row; the
// connector uploads the command, and the server's answer comes back as an
// `offline_command` row of this device.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show TableUpdate;
import 'package:drift_sqlite_async/drift_sqlite_async.dart';
import 'package:logging/logging.dart';
import 'package:path/path.dart' as p;
import 'package:powersync/powersync.dart';
import 'package:s1_flutter_probe/drift_base.dart';
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/key_store.dart';
import 'package:s1_flutter_probe/powersync/ps_connector.dart';
import 'package:s1_flutter_probe/powersync/ps_schema.dart';
import 'package:uuid/uuid.dart';

// The SDK must not print sync details (ids, URLs) to the console.
final _silent = Logger.detached('s1-probe')..level = Level.OFF;

const _appointments = r'''
  SELECT a.id, a.starts_at,
         CASE WHEN EXISTS (
           SELECT 1 FROM pending_cancel c
            WHERE c.appointment_id = a.id
              AND NOT EXISTS (
                SELECT 1 FROM offline_command o
                 WHERE o.id = c.id
                   AND json_extract(o.result, '$.status') <> 'applied'))
              THEN 'cancelled' ELSE a.status END AS status
    FROM appointment a
   ORDER BY a.starts_at''';

class PsEngine implements ProbeEngine {
  new(this.config);

  final ProbeConfig config;

  PowerSyncDatabase? _db;
  ProbeDriftDb? _drift;
  PsConnector? _connector;
  StreamSubscription<SyncStatus>? _statusSub;
  bool _connected = false;

  @override
  String get databasePath => p.join(config.directory, 's1-powersync.db');

  PowerSyncDatabase get _ps => _db ?? (throw StateError('engine not open'));
  ProbeDriftDb get _views => _drift ?? (throw StateError('engine not open'));

  @override
  ProbeStatus get status => (_connector?.needsLogin ?? false)
      ? ProbeStatus.needsLogin
      : _connected
      ? ProbeStatus.online
      : ProbeStatus.offline;

  @override
  Future<void> open(String token) async {
    final url = config.powersyncUrl;
    if (url == null) throw ArgumentError('the PowerSync engine needs a URL');
    final key = passphraseOf(await loadOrCreateKey(config.keys));
    final db = PowerSyncDatabase(
      schema: psSchema,
      path: databasePath,
      logger: _silent,
      encryption: EncryptionOptions(key: key),
    );
    await db.initialize();
    _db = db;
    _drift = ProbeDriftDb(
      SqliteAsyncDriftConnection(
        db,
        transformTableUpdates: (n) => {
          for (final t in n.tables) TableUpdate(viewOf(t)),
        },
      ),
    );
    _statusSub = db.statusStream.listen((s) => _connected = s.connected);
    final connector = PsConnector(
      serverUrl: config.serverUrl,
      powersyncUrl: url,
      token: token,
    );
    _connector = connector;
    await db.connect(
      connector: connector,
      options: const SyncOptions(
        retryDelay: Duration(seconds: 2),
        crudThrottleTime: Duration(milliseconds: 300),
      ),
    );
  }

  @override
  Stream<List<Appointment>> appointments() => _views.watchTables(
    {'appointment', 'pending_cancel', 'offline_command'},
    () async => [
      for (final r in await _views.customSelect(_appointments).get())
        Appointment(
          id: r.read<String>('id'),
          startsAt: r.read<String>('starts_at'),
          status: r.read<String>('status'),
        ),
    ],
  );

  @override
  Stream<Ticket?> ticket() => _views.watchTables({'queue_ticket'}, () async {
    final r = await _views
        .customSelect(
          'SELECT id, real_number, provisional_number, status, walk_in_label '
          'FROM queue_ticket ORDER BY shift_date DESC LIMIT 1',
        )
        .getSingleOrNull();
    if (r == null) return null;
    return Ticket(
      id: r.read<String>('id'),
      number:
          r.readNullable<int>('real_number') ??
          r.read<int>('provisional_number'),
      status: r.read<String>('status'),
      label: r.read<String>('walk_in_label'),
    );
  });

  @override
  Future<void> cancel(String appointmentId) async {
    final id = const Uuid().v4();
    await _ps.writeTransaction((tx) async {
      await tx.execute(
        'INSERT INTO outbox_command '
        '(id, type, payload, device_id, offline, client_time) '
        'VALUES (?, ?, ?, ?, ?, ?)',
        [
          id,
          'appointment.cancel',
          jsonEncode({'appointmentId': appointmentId}),
          config.deviceId,
          if (_connected) 0 else 1,
          DateTime.now().toUtc().toIso8601String(),
        ],
      );
      await tx.execute(
        'INSERT INTO pending_cancel (id, appointment_id) VALUES (?, ?)',
        [id, appointmentId],
      );
    });
  }

  @override
  Future<int> pendingCount() async => (await _ps.getUploadQueueStats()).count;

  /// PowerSync syncs and retries on its own; this only lets it settle.
  @override
  Future<void> syncNow() => Future<void>.delayed(const Duration(seconds: 1));

  @override
  Future<void> close() async {
    await _statusSub?.cancel();
    _statusSub = null;
    _connected = false;
    await _drift?.close();
    _drift = null;
    await _db?.close();
    _db = null;
    _connector?.close();
  }

  @override
  Future<void> logout() async {
    try {
      await _db?.disconnectAndClear();
      await close();
    } finally {
      for (final suffix in ['', '-wal', '-shm', '-journal']) {
        final file = File('$databasePath$suffix');
        if (file.existsSync()) await file.delete();
      }
      await config.keys.delete();
    }
  }
}
