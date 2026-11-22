// ShifaListItem: a row of a list (slice 0.4-08, criterion 10).
import 'dart:ui' show Tristate;

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  testWidgets('a pressable row is one button named by its texts', (
    tester,
  ) async {
    var presses = 0;
    await pumpPhone(
      tester,
      ShifaListItem(
        title: 'ريم العلي',
        subtitle: 'ملف 10482',
        onPressed: () => presses++,
      ),
    );
    await tester.tap(find.text('ملف 10482'));
    expect(presses, 1);
    final data = tester
        .getSemantics(find.byType(ShifaListItem))
        .getSemanticsData();
    expect(data.flagsCollection.isButton, isTrue);
    expect(data.label, contains('ريم العلي'));
    expect(data.label, contains('ملف 10482'));
  });

  testWidgets('at least 48 tall; 64 with a second line', (tester) async {
    await pumpPhone(
      tester,
      ShifaListItem(title: 'الإعدادات', onPressed: () {}),
    );
    expect(
      tester.getSize(find.byType(ShifaListItem)).height,
      greaterThanOrEqualTo(48),
    );
    await pumpPhone(
      tester,
      ShifaListItem(
        title: 'ريم العلي',
        subtitle: 'ملف 10482',
        onPressed: () {},
      ),
    );
    expect(
      tester.getSize(find.byType(ShifaListItem)).height,
      greaterThanOrEqualTo(64),
    );
  });

  testWidgets('leading at the start, the chevron at the end, pointing on', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      SizedBox(
        width: 358,
        child: ShifaListItem(
          title: 'ريم العلي',
          leading: const SizedBox(key: Key('lead'), width: 40, height: 40),
          onPressed: () {},
        ),
      ),
    );
    final lead = tester.getCenter(find.byKey(const Key('lead')));
    final chevron = tester.getCenter(find.byType(ShifaGlyph));
    final title = tester.getCenter(find.text('ريم العلي'));
    expect(lead.dx, greaterThan(title.dx));
    expect(chevron.dx, lessThan(title.dx));
    expect(
      tester.widget<ShifaGlyph>(find.byType(ShifaGlyph)).data,
      ShifaGlyphs.chevronForward,
    );
  });

  testWidgets('a trailing widget replaces the chevron', (tester) async {
    await pumpPhone(
      tester,
      ShifaListItem(
        title: 'محمد الحلبي',
        trailing: const Text('مؤكد'),
        onPressed: () {},
      ),
    );
    expect(find.byType(ShifaGlyph), findsNothing);
    expect(find.text('مؤكد'), findsOneWidget);
  });

  testWidgets('disabled: no press, announced as disabled', (tester) async {
    var presses = 0;
    await pumpPhone(
      tester,
      ShifaListItem(
        title: 'عمر الخوري',
        enabled: false,
        onPressed: () => presses++,
      ),
    );
    await tester.tap(find.byType(ShifaListItem), warnIfMissed: false);
    expect(presses, 0);
    final data = tester
        .getSemantics(find.byType(ShifaListItem))
        .getSemanticsData();
    expect(data.flagsCollection.isEnabled, Tristate.isFalse);
  });

  testWidgets('a row without onPressed is plain text, not a button', (
    tester,
  ) async {
    await pumpPhone(tester, const ShifaListItem(title: 'فصيلة الدم'));
    final data = tester
        .getSemantics(find.text('فصيلة الدم'))
        .getSemanticsData();
    expect(data.flagsCollection.isButton, isFalse);
    expect(find.byType(ShifaGlyph), findsNothing);
  });

  testWidgets('at 200 % text nothing overflows', (tester) async {
    await pumpPhone(
      tester,
      SizedBox(
        width: 358,
        child: ShifaListItem(
          title: 'عيادة الشهباء لطب الأسنان والتقويم',
          subtitle: 'حلب · الفرقان · مفتوحة حتى 18:00',
          onPressed: () {},
        ),
      ),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
