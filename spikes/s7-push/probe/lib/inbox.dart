// Inbox (criterion 3, PAT-29, MSG-30): "صندوق الإشعارات" lists the receiver's inbox for this
// install. Fetched on open and on resume, polled every 10 s while in the foreground, and cached
// so the view works offline. The live-queue line comes from the same poll, not from push.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:s7_push_probe/receiver_api.dart';
import 'package:s7_push_probe/store.dart';

const inboxCacheFile = 'inbox_cache.json';

class InboxItem {
  const new({
    required this.s7id,
    required this.appointmentId,
    required this.kind,
    required this.title,
    required this.body,
    required this.createdAt,
  });

  factory fromJson(Map<String, Object?> json) => InboxItem(
    s7id: json['s7id']! as String,
    appointmentId: json['appointmentId']! as String,
    kind: json['kind']! as String,
    title: json['title']! as String,
    body: json['body']! as String,
    createdAt: json['createdAt']! as String,
  );

  final String s7id;
  final String appointmentId;
  final String kind;
  final String title;
  final String body;
  final String createdAt;

  Map<String, Object?> toJson() => {
    's7id': s7id,
    'appointmentId': appointmentId,
    'kind': kind,
    'title': title,
    'body': body,
    'createdAt': createdAt,
  };
}

class InboxController extends ChangeNotifier {
  new({
    required this.api,
    required this.store,
    required this.installId,
    this.pollInterval = const Duration(seconds: 10),
  });

  final ReceiverApi api;
  final ProbeStore store;
  final String installId;
  final Duration pollInterval;

  List<InboxItem> items = const [];
  String? queueLine;
  bool offline = false;
  DateTime? lastFetch;
  Timer? _timer;
  var _disposed = false;

  /// On app open: show the cache at once, fetch, then poll while in the foreground.
  void open() => unawaited(_open());

  Future<void> _open() async {
    await _loadCache();
    setForeground(foreground: true);
  }

  /// Resume fetches at once and polls; pause stops polling (no background polling).
  void setForeground({required bool foreground}) {
    _timer?.cancel();
    _timer = null;
    if (!foreground || _disposed) return;
    unawaited(refresh());
    _timer = Timer.periodic(pollInterval, (_) => unawaited(refresh()));
  }

  Future<void> refresh() async {
    try {
      final fetched = await api.inbox(installId);
      items = fetched;
      offline = false;
      lastFetch = DateTime.now();
      await store.write(
        inboxCacheFile,
        jsonEncode({
          'items': [for (final i in fetched) i.toJson()],
        }),
      );
    } on Exception {
      offline = true;
    }
    try {
      queueLine = await api.queue(installId);
    } on Exception {
      // Keep the last line; the offline banner tells the user it may be stale.
    }
    _notify();
  }

  Future<void> _loadCache() async {
    final text = await store.read(inboxCacheFile);
    if (text == null) return;
    final json = jsonDecode(text) as Map<String, Object?>;
    items = [
      for (final i in json['items']! as List<Object?>)
        InboxItem.fromJson(i! as Map<String, Object?>),
    ];
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
