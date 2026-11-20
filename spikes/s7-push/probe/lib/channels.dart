// Notification channels (criterion 1): "مواعيد" (high) for appointment events and "عام"
// (default) for the rest, created at first launch. Android keeps a channel's importance under the
// user's control once created, so an existing channel is never recreated; its current importance
// is read back for the device-state report (PAT-21).
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:s7_push_probe/push_client.dart';

enum ChannelImportance {
  none('none'),
  min('min'),
  low('low'),
  defaultImportance('default'),
  high('high'),
  max('max'),
  unknown('unknown');

  new(this.wire);

  /// The name the receiver stores.
  final String wire;
}

class ChannelSpec {
  const new(this.id, this.name, this.importance);

  final String id;
  final String name;
  final ChannelImportance importance;
}

const appointmentsChannel = ChannelSpec(
  'appointments',
  'مواعيد',
  ChannelImportance.high,
);
const generalChannel = ChannelSpec(
  'general',
  'عام',
  ChannelImportance.defaultImportance,
);
const List<ChannelSpec> probeChannels = [appointmentsChannel, generalChannel];

abstract interface class ChannelPlatform {
  /// Existing channels: id → importance wire name.
  Future<Map<String, String>> importances();
  Future<void> create(ChannelSpec spec);

  /// Shows a foreground message (FCM does not show those itself).
  Future<void> show(PushMessage message, String channelId);
}

/// Creates the probe's channels that do not exist yet; returns how many were created.
Future<int> ensureChannels(ChannelPlatform platform) async {
  final existing = await platform.importances();
  var created = 0;
  for (final spec in probeChannels) {
    if (existing.containsKey(spec.id)) continue;
    await platform.create(spec);
    created += 1;
  }
  return created;
}

/// `{appointments: high, general: default}`; `missing` for a channel that does not exist.
Future<Map<String, String>> channelState(ChannelPlatform platform) async {
  final existing = await platform.importances();
  return {
    for (final spec in probeChannels) spec.id: existing[spec.id] ?? 'missing',
  };
}

/// Appointment events go to "مواعيد", silent sync and anything else to "عام".
String channelFor(PushMessage message) => switch (message.kind) {
  'reminder' || 'turn-near' || 'call-in' => appointmentsChannel.id,
  _ => generalChannel.id,
};

Importance _toPlugin(ChannelImportance i) => switch (i) {
  ChannelImportance.none => Importance.none,
  ChannelImportance.min => Importance.min,
  ChannelImportance.low => Importance.low,
  ChannelImportance.defaultImportance => Importance.defaultImportance,
  ChannelImportance.high => Importance.high,
  ChannelImportance.max => Importance.max,
  ChannelImportance.unknown => Importance.unspecified,
};

String _fromPlugin(Importance? i) => switch (i) {
  Importance.none => 'none',
  Importance.min => 'min',
  Importance.low => 'low',
  Importance.defaultImportance => 'default',
  Importance.high => 'high',
  Importance.max => 'max',
  _ => 'unknown',
};

/// The Android implementation through flutter_local_notifications.
class LocalNotificationsPlatform implements ChannelPlatform {
  new([FlutterLocalNotificationsPlugin? plugin])
    : _plugin = plugin ?? FlutterLocalNotificationsPlugin();

  final FlutterLocalNotificationsPlugin _plugin;
  var _nextId = 0;

  AndroidFlutterLocalNotificationsPlugin? get _android => _plugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();

  Future<void> initialize() async {
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      ),
    );
  }

  @override
  Future<Map<String, String>> importances() async {
    final channels = await _android?.getNotificationChannels() ?? const [];
    return {for (final c in channels) c.id: _fromPlugin(c.importance)};
  }

  @override
  Future<void> create(ChannelSpec spec) async {
    await _android?.createNotificationChannel(
      AndroidNotificationChannel(
        spec.id,
        spec.name,
        importance: _toPlugin(spec.importance),
      ),
    );
  }

  @override
  Future<void> show(PushMessage message, String channelId) async {
    final spec = probeChannels.firstWhere(
      (c) => c.id == channelId,
      orElse: () => generalChannel,
    );
    await _android?.show(
      id: _nextId++,
      title: message.title,
      body: message.body,
      notificationDetails: AndroidNotificationDetails(
        spec.id,
        spec.name,
        importance: _toPlugin(spec.importance),
        priority: spec.importance == ChannelImportance.high
            ? Priority.high
            : Priority.defaultPriority,
        // The host-side watcher (0.3-S7b) reads the s7id from the ticker in `dumpsys`.
        ticker: message.s7id,
      ),
    );
  }
}
