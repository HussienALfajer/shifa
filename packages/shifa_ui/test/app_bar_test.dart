// ShifaAppBar and ShifaIconButton (slice 0.4-08, criterion 10).
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  testWidgets('the title is a heading at the logical start', (tester) async {
    await pumpScreen(
      tester,
      const Column(children: [ShifaAppBar(title: 'مواعيدي')]),
    );
    final data = tester.getSemantics(find.text('مواعيدي')).getSemanticsData();
    expect(data.flagsCollection.isHeader, isTrue);
    expect(tester.getTopRight(find.text('مواعيدي')).dx, greaterThan(300));
  });

  testWidgets('back sits at the start, points right in Arabic, and is named', (
    tester,
  ) async {
    var back = 0;
    await pumpScreen(
      tester,
      Column(
        children: [
          ShifaAppBar(
            title: 'تفاصيل الموعد',
            onBack: () => back++,
            actions: [
              ShifaIconButton(
                glyph: ShifaGlyphs.more,
                label: 'المزيد',
                onPressed: () {},
              ),
            ],
          ),
        ],
      ),
    );
    final backButton = find.bySemanticsLabel('رجوع');
    expect(backButton, findsOneWidget);
    final more = find.bySemanticsLabel('المزيد');
    expect(
      tester.getCenter(backButton).dx,
      greaterThan(tester.getCenter(more).dx),
    );
    await tester.tap(backButton);
    expect(back, 1);
    final arrow = find.descendant(
      of: find.byType(ShifaIconButton).first,
      matching: find.byType(Transform),
    );
    expect(arrow, findsOneWidget, reason: 'the back arrow mirrors in RTL');
  });

  testWidgets('icon buttons are 48 × 48 and named', (tester) async {
    await pumpPhone(
      tester,
      ShifaIconButton(
        glyph: ShifaGlyphs.bell,
        label: 'الإشعارات',
        onPressed: () {},
      ),
    );
    expect(tester.getSize(find.byType(ShifaIconButton)), const Size(48, 48));
    expect(find.bySemanticsLabel('الإشعارات'), findsOneWidget);
  });

  testWidgets('it clears the status bar and is at least 64 tall', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const Column(children: [ShifaAppBar(title: 'مواعيدي')]),
      padding: const EdgeInsets.only(top: 24),
    );
    expect(tester.getTopLeft(find.text('مواعيدي')).dy, greaterThan(24));
    expect(
      tester.getSize(find.byType(ShifaAppBar)).height,
      greaterThanOrEqualTo(64 + 24),
    );
  });

  testWidgets('a long title stays on one line with an ellipsis', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      ShifaAppBar(
        title: 'عيادة الشهباء لطب الأسنان والتقويم وجراحة الفم والفكين',
        onBack: () {},
      ),
    );
    final text = tester.widget<Text>(find.textContaining('عيادة الشهباء'));
    expect(text.maxLines, 1);
    expect(text.overflow, TextOverflow.ellipsis);
    expect(tester.takeException(), isNull);
  });
}
