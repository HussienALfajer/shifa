// Custom outbox engine (ADR-0031): commands queue in the encrypted local
// store and upload in order to POST /commands; GET /sync/pull refreshes the
// patient's rows after the queue is empty. A network error keeps the queue
// and retries the same ids (the server answers a replayed id with its stored
// result); a 401 keeps the queue and reports needs-login.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Variable;
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/key_store.dart';
import 'package:s1_flutter_probe/outbox/outbox_db.dart';
import 'package:uuid/uuid.dart';

class _Unauthorized implements Exception;

class OutboxEngine implements ProbeEngine {
  /// [encrypt] and [keepQueue] are false only in the red-proof stubs.
  new(this.config, {this.encrypt = true, this.keepQueue = true});

  final ProbeConfig config;
  final bool encrypt;
  final bool keepQueue;

  static const _batch = 200;
  static const _period = Duration(seconds: 2);
  static const _timeout = Duration(seconds: 10);

  OutboxDb? _db;
  http.Client? _http;
  String? _token;
  Timer? _timer;
  Future<void>? _running;
  ProbeStatus _status = ProbeStatus.offline;
  bool _closing = false;

  @override
  String get databasePath => p.join(config.directory, 's1-outbox.db');

  OutboxDb get _store => _db ?? (throw StateError('engine not open'));

  @override
  ProbeStatus get status => _status;

  @override
  Future<void> open(String token) async {
    _token = token;
    _status = ProbeStatus.offline;
    _closing = false;
    final passphrase = encrypt
        ? passphraseOf(await loadOrCreateKey(config.keys))
        : null;
    final db = OutboxDb.open(File(databasePath), passphrase: passphrase);
    _db = db;
    _http = http.Client();
    if (!keepQueue) await db.customStatement('DELETE FROM pending_command');
    _timer = Timer.periodic(_period, (_) => unawaited(syncNow()));
    unawaited(syncNow());
  }

  @override
  Stream<List<Appointment>> appointments() =>
      _store.watchTables({'appointment'}, _appointments);

  Future<List<Appointment>> _appointments() async {
    final rows = await _store
        .customSelect(
          'SELECT id, starts_at, status FROM appointment ORDER BY starts_at',
        )
        .get();
    return [
      for (final r in rows)
        Appointment(
          id: r.read<String>('id'),
          startsAt: r.read<String>('starts_at'),
          status: r.read<String>('status'),
        ),
    ];
  }

  @override
  Stream<Ticket?> ticket() => _store.watchTables({'ticket'}, _ticket);

  Future<Ticket?> _ticket() async {
    final row = await _store
        .customSelect(
          'SELECT id, number, status, label FROM ticket '
          'ORDER BY shift_date DESC LIMIT 1',
        )
        .getSingleOrNull();
    if (row == null) return null;
    return Ticket(
      id: row.read<String>('id'),
      number: row.read<int>('number'),
      status: row.read<String>('status'),
      label: row.read<String>('label'),
    );
  }

  @override
  Future<void> cancel(String appointmentId) async {
    final id = const Uuid().v4();
    final command = {
      'id': id,
      'deviceId': config.deviceId,
      'offline': _status != ProbeStatus.online,
      'clientTime': DateTime.now().toUtc().toIso8601String(),
      'type': 'appointment.cancel',
      'payload': {'appointmentId': appointmentId},
    };
    await _store.transaction(() async {
      await _store.customStatement(
        "UPDATE appointment SET status = 'cancelled' WHERE id = ?",
        [appointmentId],
      );
      await _store.customStatement(
        'INSERT INTO pending_command (id, body) VALUES (?, ?)',
        [id, jsonEncode(command)],
      );
    });
    _store.changed({'appointment', 'pending_command'});
    unawaited(syncNow());
  }

  @override
  Future<int> pendingCount() async {
    final row = await _store
        .customSelect('SELECT count(*) AS n FROM pending_command')
        .getSingle();
    return row.read<int>('n');
  }

  @override
  Future<void> syncNow() {
    if (_db == null || _closing || _status == ProbeStatus.needsLogin) {
      return Future.value();
    }
    return _running ??= _round().whenComplete(() => _running = null);
  }

  Future<void> _round() async {
    try {
      await _flush();
      await _pull();
      _status = ProbeStatus.online;
    } on _Unauthorized {
      _status = ProbeStatus.needsLogin;
    } on Object {
      // Network errors, timeouts and unexpected answers: keep the queue and
      // retry the same ids on the next round.
      _status = ProbeStatus.offline;
    }
  }

  Future<Object?> _call(String path, {Object? body}) async {
    final client = _http;
    final token = _token;
    if (client == null || token == null) throw _Unauthorized();
    final uri = config.serverUrl.resolve(path);
    final headers = {
      'authorization': 'Bearer $token',
      'content-type': 'application/json',
    };
    final res =
        await (body == null
                ? client.get(uri, headers: headers)
                : client.post(uri, headers: headers, body: jsonEncode(body)))
            .timeout(_timeout);
    if (res.statusCode == 401) throw _Unauthorized();
    if (res.statusCode != 200) {
      throw HttpException('HTTP ${res.statusCode}', uri: uri);
    }
    return jsonDecode(res.body);
  }

  Future<void> _flush() async {
    for (;;) {
      final queued = await _store
          .customSelect(
            'SELECT seq, id, body FROM pending_command ORDER BY seq LIMIT ?',
            variables: [Variable.withInt(_batch)],
          )
          .get();
      if (queued.isEmpty) return;
      final response =
          (await _call(
                '/commands',
                body: {
                  'commands': [
                    for (final r in queued) jsonDecode(r.read<String>('body')),
                  ],
                },
              ))!
              as Map<String, dynamic>;
      final results = (response['results'] as List<dynamic>)
          .cast<Map<String, dynamic>>();
      final answered = {for (final r in results) r['id'] as String};
      // Applied, conflict or refused: the server has an answer, so the command
      // leaves the queue. A command not applied leaves an optimistic row the
      // cursor pull would not revisit, so the next pull is a full snapshot.
      final undo = results.any((r) => r['status'] != 'applied');
      await _store.transaction(() async {
        if (undo) {
          await _store.customStatement("DELETE FROM meta WHERE key = 'cursor'");
        }
        for (final r in queued) {
          final id = r.read<String>('id');
          if (answered.contains(id)) {
            await _store.customStatement(
              'DELETE FROM pending_command WHERE id = ?',
              [id],
            );
          }
        }
      });
      _store.changed({'pending_command'});
      if (answered.isEmpty) return;
    }
  }

  Future<void> _pull() async {
    final cursor = await _store
        .customSelect("SELECT value FROM meta WHERE key = 'cursor'")
        .getSingleOrNull();
    final query = cursor == null
        ? ''
        : '?cursor=${Uri.encodeQueryComponent(cursor.read<String>('value'))}';
    final body = (await _call('/sync/pull$query'))! as Map<String, dynamic>;
    final rows = body['rows'] as Map<String, dynamic>;
    await _store.transaction(() async {
      for (final r
          in (rows['appointment'] as List<dynamic>)
              .cast<Map<String, dynamic>>()) {
        await _store.customStatement(
          'INSERT OR REPLACE INTO appointment (id, starts_at, status) '
          'VALUES (?, ?, ?)',
          [r['id'], '${r['start']}', r['status']],
        );
      }
      for (final r
          in (rows['queue_ticket'] as List<dynamic>)
              .cast<Map<String, dynamic>>()) {
        await _store.customStatement(
          'INSERT OR REPLACE INTO ticket '
          '(id, shift_date, number, status, label) VALUES (?, ?, ?, ?, ?)',
          [
            r['id'],
            r['shift_date'],
            r['real_number'] ?? r['provisional_number'],
            r['status'],
            r['walk_in_label'],
          ],
        );
      }
      await _store.customStatement(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('cursor', ?)",
        [body['cursor']],
      );
    });
    _store.changed({'appointment', 'ticket'});
  }

  @override
  Future<void> close() async {
    _closing = true;
    _timer?.cancel();
    _timer = null;
    await _running; // _round never throws (it catches Object).
    final db = _db;
    _db = null;
    await db?.close();
    _http?.close();
    _http = null;
  }

  @override
  Future<void> logout() async {
    try {
      await close();
    } finally {
      for (final suffix in ['', '-wal', '-shm', '-journal']) {
        final file = File('$databasePath$suffix');
        if (file.existsSync()) await file.delete();
      }
      await config.keys.delete();
      _token = null;
    }
  }
}
