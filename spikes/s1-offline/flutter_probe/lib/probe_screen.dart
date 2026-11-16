// The probe's one screen (Arabic, RTL): my appointments with a cancel button,
// my ticket, a pending badge and an offline banner. Strings are inline: the
// probe is throwaway and not part of packages/i18n.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:s1_flutter_probe/engine.dart';
import 'package:s1_flutter_probe/key_store.dart';

class ProbeScreen extends StatefulWidget {
  const new({
    required this.engine,
    required this.login,
    required this.tokens,
    super.key,
  });

  final ProbeEngine engine;
  final Future<String> Function() login;
  final TokenStore tokens;

  @override
  State<ProbeScreen> createState() => _ProbeScreenState();
}

class _ProbeScreenState extends State<ProbeScreen> {
  bool _opened = false;
  bool _noSession = false;
  int _pending = 0;
  ProbeStatus _status = ProbeStatus.offline;
  Timer? _poll;
  Stream<Ticket?> _ticket = const Stream.empty();
  Stream<List<Appointment>> _appointments = const Stream.empty();

  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  Future<void> _start() async {
    String? token;
    try {
      token = await widget.login();
      await widget.tokens.write(token);
    } on Object {
      // Offline (or refused) at start: open the cache with the last session;
      // the engine then reports offline or needs-login.
      token = await widget.tokens.read();
    }
    if (token == null) {
      if (mounted) setState(() => _noSession = true);
      return;
    }
    await widget.engine.open(token);
    if (!mounted) return;
    setState(() {
      _opened = true;
      _ticket = widget.engine.ticket();
      _appointments = widget.engine.appointments();
    });
    _poll = Timer.periodic(const Duration(seconds: 1), (_) async {
      final pending = await widget.engine.pendingCount();
      if (!mounted) return;
      setState(() {
        _pending = pending;
        _status = widget.engine.status;
      });
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    unawaited(widget.engine.close());
    super.dispose();
  }

  Future<void> _logout() async {
    _poll?.cancel();
    await widget.engine.logout();
    await widget.tokens.delete();
    if (mounted) setState(() => _opened = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('مواعيدي'),
      actions: [
        if (_pending > 0)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Badge(
              label: Text('$_pending'),
              child: const Icon(Icons.cloud_upload_outlined),
            ),
          ),
        IconButton(
          tooltip: 'تسجيل الخروج',
          onPressed: _opened ? _logout : null,
          icon: const Icon(Icons.logout),
        ),
      ],
    ),
    body: !_opened
        ? Center(
            child: Text(
              _noSession ? 'لا اتصال ولا بيانات محفوظة بعد' : 'جارٍ التحميل…',
            ),
          )
        : Column(
            children: [
              if (_status != ProbeStatus.online)
                MaterialBanner(
                  content: Text(
                    _status == ProbeStatus.needsLogin
                        ? 'انتهت الجلسة: سجّل الدخول من جديد'
                        : 'أنت غير متصل: تعرض البيانات المحفوظة',
                  ),
                  actions: const [SizedBox.shrink()],
                ),
              StreamBuilder<Ticket?>(
                stream: _ticket,
                builder: (context, snap) {
                  final t = snap.data;
                  return ListTile(
                    leading: const Icon(Icons.confirmation_number_outlined),
                    title: Text(
                      t == null ? 'لا دور لك اليوم' : 'دوري: ${t.number}',
                    ),
                    subtitle: t == null ? null : Text(_ticketStatus(t.status)),
                  );
                },
              ),
              const Divider(),
              Expanded(
                child: StreamBuilder<List<Appointment>>(
                  stream: _appointments,
                  builder: (context, snap) => ListView(
                    children: [
                      for (final a in snap.data ?? const <Appointment>[])
                        ListTile(
                          title: Text(_time(a.startsAt)),
                          subtitle: Text(a.cancelled ? 'ملغى' : 'محجوز'),
                          trailing: a.cancelled
                              ? null
                              : TextButton(
                                  onPressed: () =>
                                      unawaited(widget.engine.cancel(a.id)),
                                  child: const Text('إلغاء'),
                                ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
  );
}

String _ticketStatus(String status) => switch (status) {
  'waiting' => 'بالانتظار',
  'called' => 'تم النداء',
  'in_service' => 'عند الطبيب',
  'done' => 'انتهى',
  _ => 'لم يحضر',
};

String _time(String iso) {
  final t = DateTime.tryParse(iso)?.toLocal();
  if (t == null) return iso;
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(t.hour)}:${two(t.minute)}';
}
