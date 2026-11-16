// The outbox engine's local store: drift on package:sqlite3's SQLCipher
// build. No code generation: four small tables in plain SQL, and drift's
// table-update notifications drive the screen's streams.
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
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

class OutboxDb extends GeneratedDatabase {
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
  Iterable<TableInfo<Table, dynamic>> get allTables => const [];

  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => const [];

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) async {
      for (final statement in _schema) {
        await customStatement(statement);
      }
    },
  );

  /// Re-runs [query] whenever one of [tables] changes (first value at once).
  Stream<T> watchTables<T>(Set<String> tables, Future<T> Function() query) =>
      Stream<void>.value(null)
          .followedBy(
            tableUpdates(
              TableUpdateQuery.allOf([
                for (final t in tables) TableUpdateQuery.onTableName(t),
              ]),
            ),
          )
          .asyncMap((_) => query());

  void changed(Set<String> tables) =>
      notifyUpdates({for (final t in tables) TableUpdate(t)});
}

extension on Stream<void> {
  Stream<void> followedBy(Stream<Object?> next) async* {
    yield* this;
    yield* next.map((_) {});
  }
}
