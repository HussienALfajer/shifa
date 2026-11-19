// Criterion 1, MSG-26: no permission request at launch; "book" explains, then asks; a denial is
// recorded and shown with a way to settings.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:s7_push_probe/app.dart';
import 'package:s7_push_probe/permission_flow.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/store.dart';

import 'support/fakes.dart';

ProbeServices services(
  FakePushClient push,
  FakeReceiver receiver,
  MemoryStore store,
) => ProbeServices(
  push: push,
  channels: FakeChannelPlatform(),
  store: store,
  receiverUrl: Uri.parse('http://receiver.test'),
  httpClient: receiver.client,
  deviceInfo: const DeviceInfo(appVersion: '0.0.1', sdkInt: 34, model: 'test'),
  openSettings: () async {},
);

void main() {
  testWidgets('launching the app never asks for notification permission', (
    tester,
  ) async {
    final push = FakePushClient();
    await tester.pumpWidget(
      ProbeApp(services: services(push, FakeReceiver(), MemoryStore())),
    );
    await tester.pumpAndSettle();

    expect(find.text('احجز موعداً'), findsOneWidget);
    expect(push.requestCount, 0);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'book shows the explanation, then requests; a denial is recorded and shown',
    (tester) async {
      final push = FakePushClient(answer: PushPermission.denied);
      final store = MemoryStore();
      var settingsOpened = 0;
      final s = services(
        push,
        FakeReceiver(),
        store,
      ).copyWith(openSettings: () async => settingsOpened += 1);
      await tester.pumpWidget(ProbeApp(services: s));
      await tester.pumpAndSettle();

      await tester.tap(find.text('احجز موعداً'));
      await tester.pumpAndSettle();
      expect(find.textContaining('لنذكّرك بموعدك'), findsOneWidget);
      expect(
        push.requestCount,
        0,
        reason: 'the explanation comes before the system prompt',
      );

      await tester.tap(find.text('متابعة'));
      await tester.pumpAndSettle();
      expect(push.requestCount, 1);
      expect(find.text('التنبيهات متوقفة'), findsOneWidget);
      expect(await store.read(permissionKey), contains('denied'));

      await tester.tap(find.text('افتح الإعدادات'));
      await tester.pumpAndSettle();
      expect(settingsOpened, 1);

      await tester.pumpWidget(const SizedBox());
    },
  );

  test('a granted answer is recorded; an already granted permission is not asked again', () async {
    final push = FakePushClient();
    final store = MemoryStore();
    final flow = PermissionFlow(push: push, store: store);
    await flow.load();
    flow.book();
    expect(flow.stage, BookingStage.explaining);
    expect(flow.appointment?.clinic, 'عيادة تجريبية');
    await flow.confirm();
    expect(flow.permission, PushPermission.granted);
    expect(await store.read(permissionKey), contains('granted'));

    final again = PermissionFlow(push: push, store: store);
    await again.load();
    again.book();
    expect(again.stage, BookingStage.done);
    expect(push.requestCount, 1);
  });
}
