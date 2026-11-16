// Logout removes the patient's data from the device: the database files and the key are gone,
// and a new engine starts empty.
import 'package:flutter_test/flutter_test.dart';
import 'package:s1_flutter_probe/key_store.dart';

import 'support/probe.dart';

void main() {
  setUpAll(Probe.requireStack);
  setUp(Probe.restore);
  tearDown(Probe.restore);

  test('logout deletes the database files and the key', () async {
    final dir = tempStore();
    addTearDown(() => dir.delete(recursive: true));
    final keys = MemoryKeyStore();
    final token = await Probe.login();
    final engine = Probe.newEngine(dir, keys);
    await engine.open(token);
    await firstWhere(
      engine.appointments(),
      (a) => a.length == seededAppointments,
    );
    final path = engine.databasePath;
    expect(await keys.read(), isNotNull);

    await engine.logout();

    for (final file in databaseFiles(path)) {
      expect(file.existsSync(), isFalse, reason: '${file.path} left behind');
    }
    expect(await keys.read(), isNull);

    // A new engine on the same directory, offline, has nothing cached.
    await Probe.cut();
    final next = Probe.newEngine(dir, keys);
    await next.open(token);
    expect(await next.appointments().first, isEmpty);
    expect(await next.ticket().first, isNull);
    await next.logout();
  });
}
