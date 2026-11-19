// Posts that could not reach the receiver (offline) wait here and are sent in order on the next
// flush. A device report replaces any queued device report: only the latest state matters.
import 'dart:convert';

import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

const outboxFile = 'outbox.json';

class Outbox {
  new(this.store);

  final ProbeStore store;

  /// Read-modify-write of the queue file, one at a time within this isolate.
  final _serial = SerialQueue();

  Future<List<Map<String, Object?>>> _load() async {
    final text = await store.read(outboxFile);
    if (text == null || text.isEmpty) return [];
    return [
      for (final e in jsonDecode(text) as List<Object?>)
        e! as Map<String, Object?>,
    ];
  }

  Future<void> _save(List<Map<String, Object?>> entries) =>
      store.write(outboxFile, jsonEncode(entries));

  /// Queues [body] for `/devices` (kind `device`) or `/receipts` (kind `receipt`).
  Future<void> add(String kind, Map<String, Object?> body) =>
      _serial.run(() => _add(kind, body));

  Future<void> _add(String kind, Map<String, Object?> body) async {
    final entries = await _load();
    if (kind == 'device') entries.removeWhere((e) => e['kind'] == 'device');
    entries.add({'kind': kind, 'body': body});
    await _save(entries);
  }

  Future<int> get length => _serial.run(() async => (await _load()).length);

  /// Sends queued entries in order; stops at the first failure. Returns how many were sent.
  Future<int> flush(ReceiverApi api) => _serial.run(() => _flush(api));

  Future<int> _flush(ReceiverApi api) async {
    final entries = await _load();
    var sent = 0;
    try {
      for (final e in entries) {
        await api.post(
          e['kind']! as String,
          e['body']! as Map<String, Object?>,
        );
        sent += 1;
      }
    } on Exception {
      // Still offline: keep the rest for the next flush.
    }
    if (sent > 0) await _save(entries.sublist(sent));
    return sent;
  }
}
