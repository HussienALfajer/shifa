// drift without code generation, shared by both engines: no generated tables,
// plain SQL, and drift's table-update notifications drive the screen's
// streams (the outbox store notifies itself; PowerSync's updates arrive
// through drift_sqlite_async).
import 'dart:async';

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
  /// It listens for updates before the first read, so a change committed
  /// during that read is not missed; reads run one after another, in order.
  Stream<T> watchTables<T>(Set<String> tables, Future<T> Function() query) {
    final updates = tableUpdates(
      TableUpdateQuery.allOf([
        for (final t in tables) TableUpdateQuery.onTableName(t),
      ]),
    );
    late final StreamController<T> out;
    StreamSubscription<Set<TableUpdate>>? sub;
    var chain = Future<void>.value();
    void refresh() {
      chain = chain.then((_) async {
        try {
          final value = await query();
          if (!out.isClosed) out.add(value);
        } on Object catch (e, st) {
          if (!out.isClosed) out.addError(e, st);
        }
      });
    }

    out = StreamController<T>(
      onListen: () {
        sub = updates.listen((_) => refresh());
        refresh();
      },
      onCancel: () => sub?.cancel(),
    );
    return out.stream;
  }

  void changed(Set<String> tables) =>
      notifyUpdates({for (final t in tables) TableUpdate(t)});
}
