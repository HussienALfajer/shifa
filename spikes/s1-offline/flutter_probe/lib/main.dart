// The probe app: one Arabic RTL screen for a synthetic patient. Configured by
// --dart-define (S1_ENGINE, S1_SERVER_URL, S1_POWERSYNC_URL, S1_PATIENT_ID,
// S1_DEVICE_ID); the scenario stack or `serve` provides the services.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/probe_screen.dart';
import 'package:s1_flutter_probe/secure_key_store.dart';

const _engine = String.fromEnvironment('S1_ENGINE', defaultValue: 'outbox');
const _server = String.fromEnvironment('S1_SERVER_URL');
const _powersync = String.fromEnvironment('S1_POWERSYNC_URL');
const _patient = String.fromEnvironment('S1_PATIENT_ID');
const _device = String.fromEnvironment(
  'S1_DEVICE_ID',
  defaultValue: 'probe-app',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dir = await getApplicationSupportDirectory();
  final engine = createEngine(
    _engine,
    ProbeConfig(
      serverUrl: Uri.parse(_server),
      powersyncUrl: _powersync.isEmpty ? null : Uri.parse(_powersync),
      deviceId: _device,
      directory: dir.path,
      keys: SecureKeyStore(),
    ),
  );
  runApp(
    ProbeApp(
      engine: engine,
      login: () => patientLogin(Uri.parse(_server), _patient, _device),
    ),
  );
}

class ProbeApp extends StatelessWidget {
  const new({required this.engine, required this.login, super.key});

  final ProbeEngine engine;
  final Future<String> Function() login;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'شفاء — مسبار',
    builder: (context, child) =>
        Directionality(textDirection: TextDirection.rtl, child: child!),
    home: ProbeScreen(engine: engine, login: login),
  );
}
