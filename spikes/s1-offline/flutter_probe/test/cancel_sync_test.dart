// Criterion 11 / SCH-13: a cancellation made in airplane mode survives a restart, fails one flush
// while still cut, and reaches the server exactly once after reconnecting. Cancelling another
// patient's appointment is refused and changes nothing.
import 'package:flutter_test/flutter_test.dart';
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/key_store.dart';

import 'support/probe.dart';

void main() {
  setUpAll(Probe.requireStack);
  setUp(Probe.restore);
  tearDown(Probe.restore);

  test(
    'an offline cancel syncs exactly once; a foreign cancel is refused',
    () async {
      final dir = tempStore();
      final keys = MemoryKeyStore();
      final token = await Probe.login();
      final first = Probe.newEngine(dir, keys);
      await first.open(token);
      final synced = await firstWhere(
        first.appointments(),
        (a) => a.length == seededAppointments,
      );
      final target = synced.firstWhere((a) => !a.cancelled);
      final otherBefore =
          (await Probe.serverAppointments())[Probe.otherAppointmentId];
      expect(otherBefore, isNotNull);

      await Probe.cut();
      await first.cancel(target.id);
      final shown = await firstWhere(
        first.appointments(),
        (a) => a.any((x) => x.id == target.id && x.cancelled),
      );
      expect(
        shown.where((a) => a.cancelled).map((a) => a.id),
        contains(target.id),
      );
      expect(await first.pendingCount(), 1);

      // Restart while still offline: the queue survives.
      await first.close();
      final engine = Probe.newEngine(dir, keys);
      addTearDown(engine.logout);
      await engine.open(token);
      expect(await engine.pendingCount(), 1);

      // One failed flush while cut.
      await engine.syncNow();
      expect(await engine.pendingCount(), 1);
      expect(engine.status, ProbeStatus.offline);

      await Probe.restore();
      await eventually(
        engine,
        () async => await engine.pendingCount() == 0,
        reason: 'queue drained',
      );
      expect(await Probe.report(), containsPair('commands', 1));
      expect(await Probe.report(), containsPair('applied', 1));
      expect((await Probe.serverAppointments())[target.id], 'cancelled');
      await eventually(
        engine,
        () async => (await engine.appointments().first).any(
          (a) => a.id == target.id && a.cancelled,
        ),
        reason: 'cancelled appointment pulled',
      );
      expect(engine.status, ProbeStatus.online);

      await engine.cancel(Probe.otherAppointmentId);
      await eventually(
        engine,
        () async =>
            (await Probe.report())['commands'] == 2 &&
            await engine.pendingCount() == 0,
        reason: 'foreign cancel answered',
      );
      final report = await Probe.report();
      expect(report, containsPair('applied', 1));
      expect(report, containsPair('refused', 1));
      expect(
        (await Probe.serverAppointments())[Probe.otherAppointmentId],
        otherBefore,
      );
    },
  );
}
