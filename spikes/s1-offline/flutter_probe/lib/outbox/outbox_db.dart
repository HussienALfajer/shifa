// The outbox engine's local store: drift on package:sqlite3's SQLCipher
// build, four small tables in plain SQL (no code generation).
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:s1_flutter_probe/drift_base.dart';
import 'package:s1_flutter_probe/key_store.dart';

const _schema = [
  '''
  CREATE TABLE appointment (
    id TEXT PRIMARY KEY, starts_at TEXT NOT NULL, status TEXT NOT NULL
  )''',
  '''
  CREATE TABLE ticket (
    id TEXT PRIMARY KEY, shift_date TEXT NOT NULL, number INTEGER NOT NULL,
    status TEXT NOT NULL, label TEXT NOT NULL
  )''',
  '''
  CREATE TABLE pending_command (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
    body TEXT NOT NULL
  )''',
  'CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
];

class OutboxDb extends ProbeDriftDb {
  new _(super.executor);

  /// Opens [file]; with a [passphrase], `PRAGMA key` runs before any other
  /// statement and a wrong key fails here, not on the first query.
  factory open(File file, {String? passphrase}) => OutboxDb._(
    NativeDatabase(
      file,
      setup: (db) {
        if (passphrase != null) db.execute(pragmaKey(passphrase));
        db
          ..select('SELECT count(*) FROM sqlite_master')
          ..execute('PRAGMA journal_mode = WAL');
      },
    ),
  );

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      for (final statement in _schema) {
        await customStatement(statement);
      }
    },
  );
}
