// ShifaButton: label, touch target, disabled, loading, keyboard, text scale
// (slice 0.4-08, criterion 10).
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  testWidgets('a press calls onPressed; the label is its name', (tester) async {
    var presses = 0;
    await pumpPhone(
      tester,
      ShifaButton(label: 'احجز موعداً', onPressed: () => presses++),
    );
    await tester.tap(find.byType(ShifaButton));
    expect(presses, 1);
    expect(
      tester.getSemantics(find.byType(ShifaButton)),
      matchesSemantics(
        label: 'احجز موعداً',
        isButton: true,
        hasEnabledState: true,
        isEnabled: true,
        isFocusable: true,
        hasTapAction: true,
        hasFocusAction: true,
      ),
    );
  });

  testWidgets('every variant is at least 48 × 48', (tester) async {
    for (final variant in ShifaButtonVariant.values) {
      await pumpPhone(
        tester,
        ShifaButton(label: 'تم', variant: variant, onPressed: () {}),
      );
      expect(
        shortestSide(tester, find.byType(ShifaButton)),
        greaterThanOrEqualTo(48),
        reason: variant.name,
      );
    }
  });

  testWidgets('disabled: no press, announced as disabled', (tester) async {
    await pumpPhone(
      tester,
      const ShifaButton(label: 'تغيير الموعد', onPressed: null),
    );
    await tester.tap(find.byType(ShifaButton), warnIfMissed: false);
    final semantics = tester.getSemantics(find.byType(ShifaButton));
    expect(
      semantics,
      matchesSemantics(
        label: 'تغيير الموعد',
        isButton: true,
        hasEnabledState: true,
      ),
    );
  });

  testWidgets('loading: keeps its label, shows the spinner, ignores presses', (
    tester,
  ) async {
    var presses = 0;
    await pumpPhone(
      tester,
      ShifaButton(
        label: 'احجز موعداً',
        loading: true,
        onPressed: () => presses++,
      ),
    );
    expect(find.text('احجز موعداً'), findsOneWidget);
    expect(find.byType(ShifaSpinner), findsOneWidget);
    await tester.tap(find.byType(ShifaButton));
    await tester.pump(const Duration(milliseconds: 300));
    expect(presses, 0);
    final data = tester
        .getSemantics(find.byType(ShifaButton))
        .getSemanticsData();
    expect(data.label, 'احجز موعداً');
    expect(data.hint, 'جارٍ التحميل');
  });

  testWidgets('Enter and Space press a focused button', (tester) async {
    var presses = 0;
    final focus = FocusNode();
    addTearDown(focus.dispose);
    await pumpPhone(
      tester,
      ShifaButton(label: 'ادفع', focusNode: focus, onPressed: () => presses++),
    );
    focus.requestFocus();
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.sendKeyEvent(LogicalKeyboardKey.space);
    expect(presses, 2);
  });

  testWidgets('the icon sits at the logical start (the right in Arabic)', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      ShifaButton(
        label: 'احجز الموعد',
        icon: const SizedBox(key: Key('icon'), width: 20, height: 20),
        onPressed: () {},
      ),
    );
    final icon = tester.getCenter(find.byKey(const Key('icon')));
    final label = tester.getCenter(find.text('احجز الموعد'));
    expect(icon.dx, greaterThan(label.dx));
  });

  testWidgets('at 200 % text the label wraps and nothing overflows', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      ShifaButton(
        label: 'تأكيد الحجز وإرسال التذكير إلى الهاتف',
        variant: ShifaButtonVariant.primary,
        expand: true,
        onPressed: () {},
      ),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(ShifaButton)).height, greaterThan(48));
  });

  testWidgets('the primary fill is the token colour of each theme', (
    tester,
  ) async {
    for (final theme in [ShifaThemeData.light(), ShifaThemeData.dark()]) {
      await pumpPhone(
        tester,
        ShifaButton(
          label: 'احجز',
          variant: ShifaButtonVariant.primary,
          onPressed: () {},
        ),
        theme: theme,
      );
      // A theme switch animates the fill (150 ms): read it once it settles.
      await tester.pumpAndSettle();
      final box = tester.widget<DecoratedBox>(
        find
            .descendant(
              of: find.byType(ShifaButton),
              matching: find.byType(DecoratedBox),
            )
            .first,
      );
      expect(
        (box.decoration as BoxDecoration).color,
        theme.colors.buttonPrimaryBg,
      );
    }
  });
}
