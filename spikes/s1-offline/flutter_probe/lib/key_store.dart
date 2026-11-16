// The database key: 32 random bytes per install, kept only in a KeyStore (platform secure
// storage in the app, memory in host tests). Never logged, never sent anywhere.
import 'dart:math';
import 'dart:typed_data';

abstract interface class KeyStore {
  Future<Uint8List?> read();
  Future<void> write(Uint8List key);
  Future<void> delete();
}

/// Host tests: `flutter_secure_storage` needs a platform channel.
class MemoryKeyStore implements KeyStore {
  Uint8List? _key;

  @override
  Future<Uint8List?> read() async => _key;

  @override
  Future<void> write(Uint8List key) async => _key = Uint8List.fromList(key);

  @override
  Future<void> delete() async => _key = null;
}

/// The stored key, or a new random one stored first.
Future<Uint8List> loadOrCreateKey(KeyStore store) async {
  final existing = await store.read();
  if (existing != null) return existing;
  final random = Random.secure();
  final key = Uint8List.fromList(List.generate(32, (_) => random.nextInt(256)));
  await store.write(key);
  return key;
}

/// The SQLCipher passphrase for a key (hex text; both engines use the same form).
String passphraseOf(Uint8List key) =>
    key.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

/// `PRAGMA key` for a passphrase, quoted as an SQL string literal.
String pragmaKey(String passphrase) =>
    "PRAGMA key = '${passphrase.replaceAll("'", "''")}'";
