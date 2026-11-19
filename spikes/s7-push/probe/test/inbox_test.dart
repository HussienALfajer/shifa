// Criterion 3, PAT-29, MSG-30: inbox fetched on open and resume, polled every 10 s in the
// foreground only; the cached inbox is shown offline. Also the clock offset (edge case "skew").
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:s7_push_probe/clock.dart';
import 'package:s7_push_probe/inbox.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

import 'support/fakes.dart';

void main() {
  late FakeReceiver receiver;
  late ReceiverApi api;
  late MemoryStore store;

  setUp(() {
    receiver = FakeReceiver()..inbox = [inboxItem('s7-1')];
    api = ReceiverApi(
      Uri.parse('http://receiver.test'),
      client: receiver.client,
    );
    store = MemoryStore();
  });

  InboxController controller() =>
      InboxController(api: api, store: store, installId: 'install-1');

  test('fetched on open, polled every 10 s in the foreground only, fetched again on resume', () {
    fakeAsync((async) {
      final inbox = controller();
      int fetches() => receiver.to('/inbox').length;

      inbox.open();
      async.flushMicrotasks();
      expect(fetches(), 1);
      expect(inbox.items.map((i) => i.s7id), ['s7-1']);
      expect(receiver.to('/inbox').first.query['installId'], 'install-1');
      expect(inbox.queueLine, 'دورك بعد ٣');

      receiver.inbox = [inboxItem('s7-1'), inboxItem('s7-2')];
      async.elapse(const Duration(seconds: 30));
      expect(fetches(), 4);
      expect(inbox.items.map((i) => i.s7id), ['s7-1', 's7-2']);

      inbox.setForeground(foreground: false);
      async.elapse(const Duration(seconds: 60));
      expect(fetches(), 4, reason: 'no polling in the background');

      inbox.setForeground(foreground: true);
      async.flushMicrotasks();
      expect(fetches(), 5, reason: 'fetched at once on resume');
      async.elapse(const Duration(seconds: 10));
      expect(fetches(), 6);

      inbox.dispose();
      async.elapse(const Duration(seconds: 60));
      expect(fetches(), 6);
    });
  });

  test('the cached inbox is shown offline', () {
    fakeAsync((async) {
      final first = controller()..open();
      async.flushMicrotasks();
      first.dispose();

      receiver.online = false;
      final second = controller()..open();
      async.flushMicrotasks();
      expect(second.offline, isTrue);
      expect(second.items.map((i) => i.s7id), ['s7-1']);

      receiver.online = true;
      async.elapse(const Duration(seconds: 10));
      expect(second.offline, isFalse);
      second.dispose();
    });
  });

  test('clock offset uses the sample with the lowest round trip', () async {
    // nowMs is read before and after each of the three /time calls: round trips 80, 20 and 50 ms.
    final local = [1_000, 1_080, 2_000, 2_020, 3_000, 3_050].iterator;
    receiver.serverNowMs = 5_000;
    final offset = await measureClockOffset(
      api,
      nowMs: () => (local..moveNext()).current,
    );
    expect(receiver.to('/time'), hasLength(3));
    expect(offset.rttMs, 20);
    // The server read 5000 at the local midpoint 2010 of the best sample.
    expect(offset.offsetMs, 2_990);
  });
}
