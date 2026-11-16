// Criterion 11: the local store is encrypted with SQLCipher. Without the key (or with a wrong one)
// the file does not open, and its bytes hold no known synthetic value in plain text.
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:s1_flutter_probe/key_store.dart';
import 'package:sqlite3/sqlite3.dart';

import 'support/probe.dart';

bool _contains(Uint8List haystack, List<int> needle) {
  outer:
  for (var i = 0; i + needle.length <= haystack.length; i++) {
    for (var j = 0; j < needle.length; j++) {
      if (haystack[i + j] != needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

Object? _openAndRead(String path, String? key) {
  final db = sqlite3.open(path);
  try {
    if (key != null) db.execute(pragmaKey(key));
    return db.select('SELECT count(*) AS n FROM sqlite_master').first['n'];
  } finally {
    db.close();
  }
}

void main() {
  setUpAll(Probe.requireStack);
  setUp(Probe.restore);

  test('the store is SQLCipher-encrypted with the KeyStore key', () async {
    final dir = tempStore();
    final keys = MemoryKeyStore();
    final engine = Probe.newEngine(dir, keys);
    await engine.open(await Probe.login());
    final appointments = await firstWhere(
      engine.appointments(),
      (a) => a.length == seededAppointments,
    );
    final ticket = await firstWhere(engine.ticket(), (t) => t != null);
    final path = engine.databasePath;
    await engine.close();
    addTearDown(() => dir.delete(recursive: true));

    final known = [
      utf8.encode(ticket!.label),
      utf8.encode(appointments.first.id),
    ];
    var checked = 0;
    for (final file in databaseFiles(path)) {
      if (!file.existsSync()) continue;
      checked++;
      final bytes = file.readAsBytesSync();
      for (final value in known) {
        expect(
          _contains(bytes, value),
          isFalse,
          reason: '${file.path} holds plain text',
        );
      }
    }
    expect(checked, greaterThan(0));

    expect(() => _openAndRead(path, null), throwsA(isA<SqliteException>()));
    expect(
      () => _openAndRead(path, 'wrong-key'),
      throwsA(isA<SqliteException>()),
    );

    final key = passphraseOf((await keys.read())!);
    expect(_openAndRead(path, key), isA<int>());
    final db = sqlite3.open(path);
    try {
      db.execute(pragmaKey(key));
      final version = db.select('PRAGMA cipher_version');
      expect(version, isNotEmpty);
      expect(version.first.values.first.toString(), isNotEmpty);
    } finally {
      db.close();
    }
  });
}
