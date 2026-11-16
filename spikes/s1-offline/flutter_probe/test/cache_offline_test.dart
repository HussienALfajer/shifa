// Criterion 11 / PAT-08: after one sync the patient's appointments and ticket stay readable in
// airplane mode across an app restart; criterion 10 on the device: no other patient's rows.
import 'package:flutter_test/flutter_test.dart';
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/key_store.dart';

import 'support/probe.dart';

void main() {
  setUpAll(Probe.requireStack);
  setUp(Probe.restore);
  tearDown(Probe.restore);

  test(
    'cached appointments and ticket are readable offline after a restart',
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
      final ticket = await firstWhere(first.ticket(), (t) => t != null);

      await Probe.cut();
      await first.close();

      final restarted = Probe.newEngine(dir, keys);
      addTearDown(restarted.logout);
      await restarted.open(token);
      final cached = await restarted.appointments().first;
      expect(cached.map((a) => a.id).toSet(), synced.map((a) => a.id).toSet());
      final cachedTicket = await restarted.ticket().first;
      expect(cachedTicket?.id, ticket?.id);
      expect(cachedTicket?.number, ticket?.number);

      await restarted.syncNow();
      expect(restarted.status, ProbeStatus.offline);

      expect(
        cached.map((a) => a.id),
        isNot(contains(Probe.otherAppointmentId)),
      );
      expect(cachedTicket?.id, isNot(Probe.otherTicketId));
    },
  );
}
