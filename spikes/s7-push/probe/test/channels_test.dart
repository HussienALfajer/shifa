// Criterion 1: channels "مواعيد" (high) and "عام" (default) at first launch, not recreated later.
import 'package:flutter_test/flutter_test.dart';
import 'package:s7_push_probe/channels.dart';

import 'support/fakes.dart';

void main() {
  test(
    'first launch creates both channels with the right names and importance',
    () async {
      final platform = FakeChannelPlatform();
      expect(await ensureChannels(platform), 2);

      final byId = {for (final c in platform.created) c.id: c};
      expect(byId['appointments']?.name, 'مواعيد');
      expect(byId['appointments']?.importance, ChannelImportance.high);
      expect(byId['general']?.name, 'عام');
      expect(byId['general']?.importance, ChannelImportance.defaultImportance);

      expect(await channelState(platform), {
        'appointments': 'high',
        'general': 'default',
      });
    },
  );

  test('a second launch does not recreate them (a channel the user turned off stays off)', () async {
    final platform = FakeChannelPlatform();
    await ensureChannels(platform);
    // The user turns "مواعيد" off in system settings.
    platform.channels['appointments'] = const ChannelSpec(
      'appointments',
      'مواعيد',
      ChannelImportance.none,
    );
    platform.created.clear();

    expect(await ensureChannels(platform), 0);
    expect(platform.created, isEmpty);
    expect(await channelState(platform), {
      'appointments': 'none',
      'general': 'default',
    });
  });

  test('a missing channel is reported as missing', () async {
    expect(await channelState(FakeChannelPlatform()), {
      'appointments': 'missing',
      'general': 'missing',
    });
  });

  test('messages go to the channel their kind names', () {
    expect(channelFor(message('a')), 'appointments');
    expect(channelFor(message('b', kind: 'call-in')), 'appointments');
    expect(channelFor(message('c', kind: 'sync')), 'general');
  });
}
