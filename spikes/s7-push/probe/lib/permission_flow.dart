// Permission after a meaningful action (criterion 1, MSG-26): never at launch. "احجز موعداً"
// books a synthetic appointment, explains why ("لنذكّرك بموعدك"), and only then asks for
// POST_NOTIFICATIONS. The answer is stored and a denial is shown with a way to settings.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:s7_push_probe/push_client.dart';
import 'package:s7_push_probe/store.dart';

const permissionKey = 'permission.json';

enum BookingStage { idle, explaining, done }

class SyntheticAppointment {
  const new(this.id, this.at);

  final String id;
  final DateTime at;
  String get clinic => 'عيادة تجريبية';
}

class PermissionFlow extends ChangeNotifier {
  new({required this.push, required this.store, this.onChanged});

  final PushClient push;
  final ProbeStore store;

  /// Called after the permission changed (the device-state report).
  final Future<void> Function()? onChanged;

  PushPermission? permission;
  BookingStage stage = BookingStage.idle;
  SyntheticAppointment? appointment;

  bool get denied => permission == PushPermission.denied;

  /// Reads the current permission without asking.
  Future<void> load() async {
    permission = await push.permission();
    notifyListeners();
  }

  void book() {
    final at = DateTime.now().add(const Duration(hours: 2));
    appointment = SyntheticAppointment('appt-${at.millisecondsSinceEpoch}', at);
    stage = permission == PushPermission.granted
        ? BookingStage.done
        : BookingStage.explaining;
    notifyListeners();
  }

  /// After the explanation: asks the system, records the answer.
  Future<void> confirm() async {
    permission = await push.requestPermission();
    await store.write(
      permissionKey,
      jsonEncode({
        'permission': permission!.wire,
        'at': DateTime.now().toUtc().toIso8601String(),
      }),
    );
    stage = BookingStage.done;
    notifyListeners();
    await onChanged?.call();
  }
}

class BookingCard extends StatelessWidget {
  const new({required this.flow, required this.onOpenSettings, super.key});

  final PermissionFlow flow;
  final Future<void> Function() onOpenSettings;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: flow,
    builder: (context, _) => Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: switch (flow.stage) {
            BookingStage.idle => [
              const Text('عيادة تجريبية — موعد تجريبي'),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: flow.book,
                child: const Text('احجز موعداً'),
              ),
            ],
            BookingStage.explaining => [
              const Text('تم حجز موعدك في عيادة تجريبية.'),
              const SizedBox(height: 8),
              const Text(
                'لنذكّرك بموعدك ونخبرك حين يقترب دورك، اسمح للتطبيق بإرسال التنبيهات.',
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => unawaited(flow.confirm()),
                child: const Text('متابعة'),
              ),
            ],
            BookingStage.done when flow.denied => [
              const Text('التنبيهات متوقفة'),
              const Text('ستجد رسائل موعدك في صندوق الإشعارات داخل التطبيق.'),
              TextButton(
                onPressed: () => unawaited(onOpenSettings()),
                child: const Text('افتح الإعدادات'),
              ),
            ],
            BookingStage.done => [const Text('سنذكّرك بموعدك.')],
          },
        ),
      ),
    ),
  );
}
