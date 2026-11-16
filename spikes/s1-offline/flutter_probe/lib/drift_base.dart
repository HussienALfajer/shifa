// drift without code generation, shared by both engines: no generated tables,
// plain SQL, and drift's table-update notifications drive the screen's
// streams (the outbox store notifies itself; PowerSync's updates arrive
// through drift_sqlite_async).
import 'package:drift/drift.dart';

class ProbeDriftDb extends GeneratedDatabase {
  new(super.executor);

  @override
  Iterable<TableInfo<Table, dynamic>> get allTables => const [];

  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => const [];

  @override
  int get schemaVersion => 1;

  /// Re-runs [query] whenever one of [tables] changes (first value at once).
  Stream<T> watchTables<T>(
    Set<String> tables,
    Future<T> Function() query,
  ) async* {
    yield await query();
    final updates = tableUpdates(
      TableUpdateQuery.allOf([
        for (final t in tables) TableUpdateQuery.onTableName(t),
      ]),
    );
    await for (final _ in updates) {
      yield await query();
    }
  }

  void changed(Set<String> tables) =>
      notifyUpdates({for (final t in tables) TableUpdate(t)});
}
