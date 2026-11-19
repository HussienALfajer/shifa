// Message log (criterion 1, edge case "arrives twice"): every received message is appended to a
// local JSONL file and posted to the receiver as a receipt, queued in the outbox when offline.
// Dedupe is by the sender's `s7id` and reads the file each time, so a line written by the
// background isolate counts for the foreground and tray-open paths too.
import 'dart:convert';

import 'package:s7_push_probe/clock.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

const messageLogFile = 'messages.jsonl';

class MessageLog {
  new({
    required this.store,
    required this.api,
    required this.outbox,
    required this.installId,
    required this.clock,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final ProbeStore store;
  final ReceiverApi api;
  final Outbox outbox;
  final String installId;
  final ClockOffset clock;
  final DateTime Function() _now;

  Future<bool> _seen(String s7id) async {
    for (final line in await store.lines(messageLogFile)) {
      final entry = jsonDecode(line) as Map<String, Object?>;
      if (entry['s7id'] == s7id) return true;
    }
    return false;
  }

  /// Logs [message] unless its `s7id` was logged before. [appState] is foreground, background or
  /// terminated; [path] is foreground, background (handler) or opened (from the tray).
  /// Returns whether it was new.
  Future<bool> record(
    PushMessage message, {
    required String appState,
    required String path,
  }) async {
    final s7id = message.s7id;
    if (s7id != null && await _seen(s7id)) return false;
    final line = <String, Object?>{
      'installId': installId,
      's7id': s7id,
      'fcmMessageId': message.messageId,
      'label': message.label,
      'sentAt': message.data['sentAt'],
      'receivedAt': _now().toUtc().toIso8601String(),
      'clockOffsetMs': clock.offsetMs,
      'appState': appState,
      'path': path,
    };
    await store.append(messageLogFile, jsonEncode(line));
    // A message the spike did not send (no s7id) is kept locally only.
    if (s7id == null) return true;
    try {
      await outbox.flush(api);
      await api.postReceipt(line);
    } on Exception {
      await outbox.add('receipt', line);
    }
    return true;
  }
}
