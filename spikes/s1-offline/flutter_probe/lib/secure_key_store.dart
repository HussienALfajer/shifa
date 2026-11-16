// The app's KeyStore: the platform's secure storage (Keychain, Android
// Keystore-backed preferences, libsecret, DPAPI). Host tests use
// MemoryKeyStore instead, because this needs a platform channel.
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:s1_flutter_probe/key_store.dart';

class SecureKeyStore implements KeyStore {
  new([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _name = 's1_probe_db_key';
  final FlutterSecureStorage _storage;

  @override
  Future<Uint8List?> read() async {
    final value = await _storage.read(key: _name);
    return value == null ? null : base64Decode(value);
  }

  @override
  Future<void> write(Uint8List key) =>
      _storage.write(key: _name, value: base64Encode(key));

  @override
  Future<void> delete() => _storage.delete(key: _name);
}
