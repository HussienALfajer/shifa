// ShifaCard: a surface, or a pressable one (slice 0.4-08, criterion 10).
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  testWidgets('a plain card is not a button and draws the card tokens', (
    tester,
  ) async {
    await pumpPhone(tester, const ShifaCard(child: Text('موعدك القادم')));
    final data = tester
        .getSemantics(find.text('موعدك القادم'))
        .getSemanticsData();
    expect(data.flagsCollection.isButton, isFalse);
    final box = tester.widget<DecoratedBox>(
      find
          .descendant(
            of: find.byType(ShifaCard),
            matching: find.byType(DecoratedBox),
          )
          .first,
    );
    final decoration = box.decoration as BoxDecoration;
    final theme = ShifaThemeData.light();
    expect(decoration.color, theme.colors.cardBg);
    expect((decoration.border! as Border).top.color, theme.colors.cardBorder);
    expect(decoration.boxShadow, theme.shapes.shadowCard);
  });

  testWidgets('a pressable card is one button named by its content', (
    tester,
  ) async {
    var presses = 0;
    await pumpPhone(
      tester,
      ShifaCard(
        onPressed: () => presses++,
        child: const Column(
          children: [Text('عيادة الشهباء'), Text('مفتوحة حتى 18:00')],
        ),
      ),
    );
    await tester.tap(find.text('مفتوحة حتى 18:00'));
    expect(presses, 1);
    final data = tester.getSemantics(find.byType(ShifaCard)).getSemanticsData();
    expect(data.flagsCollection.isButton, isTrue);
    expect(data.label, contains('عيادة الشهباء'));
    expect(data.label, contains('مفتوحة حتى 18:00'));
  });

  testWidgets('a pressed card turns the pressed colour', (tester) async {
    await pumpPhone(
      tester,
      ShifaCard(onPressed: () {}, child: const Text('عيادة الشهباء')),
      reduceMotion: true,
    );
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(ShifaCard)),
    );
    await tester.pump();
    final box = tester.widget<DecoratedBox>(
      find
          .descendant(
            of: find.byType(ShifaCard),
            matching: find.byType(DecoratedBox),
          )
          .first,
    );
    expect(
      (box.decoration as BoxDecoration).color,
      ShifaThemeData.light().colors.selectionSubtle,
    );
    await gesture.up();
  });
}
