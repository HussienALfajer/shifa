// Criterion 1, edge case "arrives twice": one log line per s7id across paths; app state recorded;
// offline receipts reach the receiver later.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:s7_push_probe/clock.dart';
import 'package:s7_push_probe/message_log.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

import 'support/fakes.dart';

void main() {
  late FakeReceiver receiver;
  late ReceiverApi api;
  late MemoryStore store;
  late Outbox outbox;
  late MessageLog log;

  setUp(() {
    receiver = FakeReceiver();
    api = ReceiverApi(
      Uri.parse('http://receiver.test'),
      client: receiver.client,
    );
    store = MemoryStore();
    outbox = Outbox(store);
    log = MessageLog(
      store: store,
      api: api,
      outbox: outbox,
      installId: 'install-1',
      clock: const ClockOffset(offsetMs: -40, rttMs: 12),
      now: () => DateTime.utc(2026, 11, 19, 8, 0, 2),
    );
  });

  Future<List<Map<String, Object?>>> lines() async => [
    for (final l in await store.lines(messageLogFile))
      jsonDecode(l) as Map<String, Object?>,
  ];

  test('logs once per s7id across foreground and tray-open paths', () async {
    expect(
      await log.record(
        message('s7-1'),
        appState: 'foreground',
        path: 'foreground',
      ),
      isTrue,
    );
    expect(
      await log.record(message('s7-1'), appState: 'background', path: 'opened'),
      isFalse,
    );
    expect(
      await log.record(
        message('s7-2', kind: 'call-in'),
        appState: 'background',
        path: 'opened',
      ),
      isTrue,
    );

    final logged = await lines();
    expect(logged.map((l) => l['s7id']), ['s7-1', 's7-2']);
    expect(logged.first, {
      'installId': 'install-1',
      's7id': 's7-1',
      'fcmMessageId': '0:s7-1',
      'label': 's7_reminder',
      'sentAt': '2026-11-19T08:00:00.000Z',
      'receivedAt': '2026-11-19T08:00:02.000Z',
      'clockOffsetMs': -40,
      'appState': 'foreground',
      'path': 'foreground',
    });
    expect(logged.last['label'], 's7_call-in');
    expect(receiver.to('/receipts').map((r) => (r.body! as Map)['s7id']), [
      's7-1',
      's7-2',
    ]);
  });

  test('a line written by the background isolate counts for dedupe', () async {
    // The background handler runs in its own isolate with its own MessageLog on the same file.
    final other = MessageLog(
      store: store,
      api: api,
      outbox: outbox,
      installId: 'install-1',
      clock: const ClockOffset(),
    );
    expect(
      await other.record(
        message('s7-9'),
        appState: 'background',
        path: 'background',
      ),
      isTrue,
    );
    expect(
      await log.record(message('s7-9'), appState: 'foreground', path: 'opened'),
      isFalse,
    );
    expect(await lines(), hasLength(1));
  });

  test(
    'a message without s7id is logged but never deduped against others',
    () async {
      final bare = message('x')..data.remove('s7id');
      expect(
        await log.record(bare, appState: 'foreground', path: 'foreground'),
        isTrue,
      );
      expect(
        await log.record(bare, appState: 'foreground', path: 'foreground'),
        isTrue,
      );
    },
  );

  test(
    'offline receipts wait in the outbox and reach the receiver later',
    () async {
      receiver.online = false;
      await log.record(
        message('s7-3'),
        appState: 'background',
        path: 'background',
      );
      await log.record(
        message('s7-4'),
        appState: 'background',
        path: 'background',
      );
      expect(await outbox.length, 2);
      expect(
        await lines(),
        hasLength(2),
        reason: 'the local log does not depend on the network',
      );

      receiver.online = true;
      expect(await outbox.flush(api), 2);
      expect(receiver.to('/receipts').map((r) => (r.body! as Map)['s7id']), [
        's7-3',
        's7-4',
      ]);
    },
  );
}
