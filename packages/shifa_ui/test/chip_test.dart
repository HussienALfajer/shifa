// ShifaChip: a filter that is on or off (slice 0.4-08, criterion 10).
import 'dart:ui' show Tristate;

import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  testWidgets('a press toggles it; selected is announced', (tester) async {
    final seen = <bool>[];
    await pumpPhone(
      tester,
      ShifaChip(label: 'القادمة', selected: true, onSelected: seen.add),
    );
    await tester.tap(find.byType(ShifaChip));
    expect(seen, [false]);
    final data = tester.getSemantics(find.byType(ShifaChip)).getSemanticsData();
    expect(data.label, 'القادمة');
    expect(data.flagsCollection.isButton, isTrue);
    expect(data.flagsCollection.isSelected, Tristate.isTrue);
  });

  testWidgets('the touch target is 48 tall though the chip draws 36', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      ShifaChip(label: 'الكل', selected: false, onSelected: (_) {}),
    );
    expect(
      tester.getSize(find.byType(ShifaChip)).height,
      greaterThanOrEqualTo(48),
    );
    expect(tester.getSize(find.byKey(ShifaChip.faceKey)).height, 36);
  });

  testWidgets('selected shows the check at the logical start', (tester) async {
    await pumpPhone(
      tester,
      ShifaChip(label: 'الكل', selected: true, onSelected: (_) {}),
    );
    final check = tester.getCenter(find.byType(ShifaGlyph));
    final label = tester.getCenter(find.text('الكل'));
    expect(check.dx, greaterThan(label.dx));
  });

  testWidgets('disabled: no toggle', (tester) async {
    final seen = <bool>[];
    await pumpPhone(
      tester,
      const ShifaChip(label: 'الملغاة', selected: false, onSelected: null),
    );
    await tester.tap(find.byType(ShifaChip), warnIfMissed: false);
    expect(seen, isEmpty);
    final data = tester.getSemantics(find.byType(ShifaChip)).getSemanticsData();
    expect(data.flagsCollection.isEnabled, Tristate.isFalse);
  });

  testWidgets('at 200 % text nothing overflows', (tester) async {
    await pumpPhone(
      tester,
      ShifaChip(label: 'هذا الأسبوع', selected: true, onSelected: (_) {}),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
