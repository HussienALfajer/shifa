// The probe's single screen (Arabic, RTL): booking card with the permission flow, the device
// state it reports, the live-queue line and "صندوق الإشعارات". Everything platform-specific
// comes in through `ProbeServices`, so widget tests run with fakes.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:s7_push_probe/channels.dart';
import 'package:s7_push_probe/clock.dart';
import 'package:s7_push_probe/device_state.dart';
import 'package:s7_push_probe/inbox.dart';
import 'package:s7_push_probe/message_log.dart';
import 'package:s7_push_probe/outbox.dart';
import 'package:s7_push_probe/permission_flow.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

export 'package:s7_push_probe/device_state.dart' show DeviceInfo;

const clockFile = 'clock.json';

class ProbeServices {
  const new({
    required this.push,
    required this.channels,
    required this.store,
    required this.receiverUrl,
    required this.deviceInfo,
    required this.openSettings,
    this.httpClient,
    this.showForeground = true,
  });

  final PushClient push;
  final ChannelPlatform channels;
  final ProbeStore store;
  final Uri receiverUrl;
  final http.Client? httpClient;
  final DeviceInfo deviceInfo;
  final Future<void> Function() openSettings;

  /// False in the `noshow` flavor (criterion 5): foreground messages are logged, not shown.
  final bool showForeground;

  ProbeServices copyWith({Future<void> Function()? openSettings}) =>
      ProbeServices(
        push: push,
        channels: channels,
        store: store,
        receiverUrl: receiverUrl,
        httpClient: httpClient,
        deviceInfo: deviceInfo,
        openSettings: openSettings ?? this.openSettings,
        showForeground: showForeground,
      );
}

class ProbeApp extends StatelessWidget {
  const new({required this.services, super.key});

  final ProbeServices services;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'مسبار التنبيهات',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(colorSchemeSeed: Colors.teal),
    builder: (context, child) =>
        Directionality(textDirection: TextDirection.rtl, child: child!),
    home: ProbeHome(services: services),
  );
}

class ProbeHome extends StatefulWidget {
  const new({required this.services, super.key});

  final ProbeServices services;

  @override
  State<ProbeHome> createState() => _ProbeHomeState();
}

class _ProbeHomeState extends State<ProbeHome> {
  late final ProbeServices s = widget.services;
  late final ReceiverApi api = ReceiverApi(s.receiverUrl, client: s.httpClient);
  late final Outbox outbox = Outbox(s.store);
  late final PermissionFlow flow = PermissionFlow(
    push: s.push,
    store: s.store,
    onChanged: _report,
  );
  final List<StreamSubscription<Object?>> _subs = [];
  AppLifecycleListener? _lifecycle;
  InboxController? inbox;
  DeviceStateReporter? reporter;
  MessageLog? log;
  Map<String, Object?> state = const {};
  var _disposed = false;

  @override
  void initState() {
    super.initState();
    unawaited(_boot());
  }

  Future<void> _boot() async {
    await ensureChannels(s.channels);
    await flow.load();
    final installId = await installIdFor(s.store);
    var clock = const ClockOffset();
    try {
      clock = await measureClockOffset(api);
      await s.store.write(
        clockFile,
        '{"offsetMs":${clock.offsetMs},"rttMs":${clock.rttMs}}',
      );
    } on Exception {
      // Offline at open: receipts carry no offset until the next open.
    }
    if (_disposed) return;
    final logger = MessageLog(
      store: s.store,
      api: api,
      outbox: outbox,
      installId: installId,
      clock: clock,
    );
    final rep = DeviceStateReporter(
      push: s.push,
      channels: s.channels,
      api: api,
      outbox: outbox,
      installId: installId,
      info: s.deviceInfo,
    );
    final box = InboxController(api: api, store: s.store, installId: installId);
    setState(() {
      log = logger;
      reporter = rep;
      inbox = box;
    });
    _subs
      ..add(rep.start())
      ..add(s.push.onForeground.listen((m) => unawaited(_onForeground(m))))
      ..add(
        s.push.onOpened.listen(
          (m) => unawaited(
            logger.record(m, appState: 'background', path: 'opened'),
          ),
        ),
      );
    final initial = await s.push.initialMessage();
    if (initial != null) {
      await logger.record(initial, appState: 'terminated', path: 'opened');
    }
    _lifecycle = AppLifecycleListener(
      onResume: () {
        inbox?.setForeground(foreground: true);
        unawaited(_report());
      },
      onHide: () => inbox?.setForeground(foreground: false),
    );
    box.open();
    await _report();
  }

  Future<void> _onForeground(PushMessage m) async {
    final isNew = await log!.record(
      m,
      appState: 'foreground',
      path: 'foreground',
    );
    if (isNew && s.showForeground) await s.channels.show(m, channelFor(m));
  }

  /// Every open, resume and permission change reports the device state (PAT-21).
  Future<void> _report() async {
    final rep = reporter;
    if (rep == null) return;
    await rep.report();
    final snapshot = await rep.snapshot();
    if (!_disposed) setState(() => state = snapshot);
  }

  @override
  void dispose() {
    _disposed = true;
    for (final sub in _subs) {
      unawaited(sub.cancel());
    }
    _lifecycle?.dispose();
    inbox?.dispose();
    flow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('مسبار التنبيهات (تجريبي)')),
    body: ListView(
      padding: const EdgeInsets.all(12),
      children: [
        BookingCard(flow: flow, onOpenSettings: s.openSettings),
        _StateCard(state: state),
        if (inbox case final box?) _InboxView(inbox: box),
      ],
    ),
  );
}

class _StateCard extends StatelessWidget {
  const new({required this.state});

  final Map<String, Object?> state;

  @override
  Widget build(BuildContext context) {
    final channels = state['channels'] as Map<String, Object?>? ?? const {};
    return Card(
      child: ListTile(
        title: const Text('حالة الجهاز'),
        subtitle: Text(
          'الإذن: ${state['permission'] ?? '…'}\n'
          'مواعيد: ${channels['appointments'] ?? '…'} · عام: ${channels['general'] ?? '…'}\n'
          'الرمز: ${state['tokenHash'] ?? '…'}',
        ),
      ),
    );
  }
}

class _InboxView extends StatelessWidget {
  const new({required this.inbox});

  final InboxController inbox;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: inbox,
    builder: (context, _) => Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            title: const Text('صندوق الإشعارات'),
            subtitle: Text(inbox.queueLine ?? ''),
          ),
          if (inbox.offline)
            const ListTile(
              leading: Icon(Icons.cloud_off),
              title: Text('غير متصل: آخر نسخة محفوظة'),
            ),
          if (inbox.items.isEmpty) const ListTile(title: Text('لا رسائل بعد')),
          for (final item in inbox.items.reversed)
            ListTile(title: Text(item.title), subtitle: Text(item.body)),
        ],
      ),
    ),
  );
}
