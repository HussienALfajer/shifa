// Regression tests for the 0.3-S7a review: silent sync is never shown in the foreground; an
// inbox opened in the background fetches once and does not poll; concurrent records of one
// s7id log it once; concurrent outbox adds keep every entry.
import 'package:fake_async/fake_async.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:s7_push_probe/app.dart';
import 'package:s7_push_probe/clock.dart';
import 'package:s7_push_probe/inbox.dart';
import 'package:s7_push_probe/message_log.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

import 'support/fakes.dart';

void main() {
  testWidgets('a foreground sync is logged, not shown; a reminder is shown', (
    tester,
  ) async {
    final push = FakePushClient();
    final channels = FakeChannelPlatform();
    final receiver = FakeReceiver();
    await tester.pumpWidget(
      ProbeApp(
        services: ProbeServices(
          push: push,
          channels: channels,
          store: MemoryStore(),
          receiverUrl: Uri.parse('http://receiver.test'),
          httpClient: receiver.client,
          deviceInfo: const DeviceInfo(
            appVersion: '0.0.1',
            sdkInt: 34,
            model: 'test',
          ),
          openSettings: () async {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    push.foreground.add(syncMessage('s7-sync'));
    await tester.pumpAndSettle();
    push.foreground.add(message('s7-visible'));
    await tester.pumpAndSettle();

    expect(channels.shown.map((s) => s.$2.s7id), ['s7-visible']);
    expect(channels.shown.single.$1, 'appointments');
    expect(receiver.to('/receipts').map((r) => (r.body! as Map)['s7id']), [
      's7-sync',
      's7-visible',
    ]);
    await tester.pumpWidget(const SizedBox());
  });

  test('an inbox opened in the background fetches once and does not poll', () {
    fakeAsync((async) {
      final receiver = FakeReceiver()..inbox = [inboxItem('s7-1')];
      final api = ReceiverApi(
        Uri.parse('http://receiver.test'),
        client: receiver.client,
      );
      final inbox = InboxController(
        api: api,
        store: MemoryStore(),
        installId: 'install-1',
      )..open(foreground: false);
      async
        ..flushMicrotasks()
        ..elapse(const Duration(seconds: 60));
      expect(receiver.to('/inbox'), hasLength(1));
      inbox.dispose();
    });
  });

  test('concurrent records of one s7id log it once; concurrent outbox adds keep all', () async {
    final receiver = FakeReceiver()..online = false;
    final api = ReceiverApi(
      Uri.parse('http://receiver.test'),
      client: receiver.client,
    );
    final store = MemoryStore();
    final outbox = Outbox(store);
    final log = MessageLog(
      store: store,
      api: api,
      outbox: outbox,
      installId: 'install-1',
      clock: const ClockOffset(),
    );
    final results = await Future.wait([
      log.record(message('s7-1'), appState: 'foreground', path: 'foreground'),
      log.record(message('s7-1'), appState: 'background', path: 'opened'),
      log.record(message('s7-2'), appState: 'foreground', path: 'foreground'),
    ]);
    expect(results, [true, false, true]);
    expect(await store.lines(messageLogFile), hasLength(2));
    expect(await outbox.length, 2);
  });
}

/// A data-only sync message: no title, no body.
PushMessage syncMessage(String s7id) => PushMessage(
  messageId: '0:$s7id',
  data: {
    's7id': s7id,
    'sentAt': '2026-11-19T08:00:00.000Z',
    'appointmentId': 'appt-1',
    'kind': 'sync',
  },
);
