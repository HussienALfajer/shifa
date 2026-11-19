// Criterion 1, PAT-21: every open and token refresh posts token, permission and channel state;
// an offline report waits in the outbox and is sent on reconnect.
import 'package:flutter_test/flutter_test.dart';
import 'package:s7_push_probe/channels.dart';
import 'package:s7_push_probe/device_state.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

import 'support/fakes.dart';

void main() {
  late FakePushClient push;
  late FakeChannelPlatform channels;
  late FakeReceiver receiver;
  late MemoryStore store;
  late Outbox outbox;
  late DeviceStateReporter reporter;

  setUp(() async {
    push = FakePushClient()..current = PushPermission.granted;
    channels = FakeChannelPlatform();
    await ensureChannels(channels);
    receiver = FakeReceiver();
    store = MemoryStore();
    outbox = Outbox(store);
    final api = ReceiverApi(
      Uri.parse('http://receiver.test'),
      client: receiver.client,
    );
    reporter = DeviceStateReporter(
      push: push,
      channels: channels,
      api: api,
      outbox: outbox,
      installId: await installIdFor(store),
      info: const DeviceInfo(
        appVersion: '0.0.1',
        sdkInt: 34,
        model: 'sdk_gphone64',
      ),
    );
  });

  test('install id is random and kept', () async {
    final first = await installIdFor(store);
    expect(first, matches(RegExp(r'^[0-9a-f]{32}$')));
    expect(await installIdFor(store), first);
    expect(await installIdFor(MemoryStore()), isNot(first));
  });

  test('an open posts token, permission and channel state', () async {
    expect(await reporter.report(), isTrue);
    final posts = receiver.to('/devices');
    expect(posts, hasLength(1));
    final body = posts.single.body! as Map<String, Object?>;
    expect(body['installId'], await installIdFor(store));
    expect(body['token'], 'fake-token-1');
    expect(body['tokenHash'], tokenHash('fake-token-1'));
    expect(body['tokenHash'], hasLength(12));
    expect(body['permission'], 'granted');
    expect(body['channels'], {'appointments': 'high', 'general': 'default'});
    expect(body['appVersion'], '0.0.1');
    expect(body['sdkInt'], 34);
    expect(body['model'], 'sdk_gphone64');
  });

  test('a token refresh posts a new report', () async {
    final sub = reporter.start();
    push
      ..token = 'fake-token-2'
      ..tokenRefresh.add('fake-token-2');
    await pumpEventQueue();
    final posts = receiver.to('/devices');
    expect(posts, hasLength(1));
    expect((posts.single.body! as Map)['token'], 'fake-token-2');
    await sub.cancel();
  });

  test(
    'offline reports are queued (latest only) and sent on reconnect',
    () async {
      receiver.online = false;
      expect(await reporter.report(), isFalse);
      push.current = PushPermission.denied;
      expect(await reporter.report(), isFalse);
      expect(
        await outbox.length,
        1,
        reason: 'a newer device report replaces the queued one',
      );

      receiver.online = true;
      final api = ReceiverApi(
        Uri.parse('http://receiver.test'),
        client: receiver.client,
      );
      expect(await outbox.flush(api), 1);
      expect(await outbox.length, 0);
      final posts = receiver.to('/devices');
      expect(posts, hasLength(1));
      expect((posts.single.body! as Map)['permission'], 'denied');
    },
  );
}
