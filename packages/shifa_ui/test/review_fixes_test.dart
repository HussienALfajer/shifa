// Findings of the 0.4-08 review, each pinned by a test.
import 'dart:ui' show SemanticsAction, Tristate;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  group('ShifaTextField (review 1, 5, 7)', () {
    testWidgets('a screen reader can tap and focus it; disabled is announced', (
      tester,
    ) async {
      await pumpPhone(tester, const ShifaTextField(label: 'رقم الهاتف'));
      final node = tester.getSemantics(find.byType(EditableText));
      final data = node.getSemanticsData();
      expect(data.hasAction(SemanticsAction.tap), isTrue);
      expect(data.hasAction(SemanticsAction.focus), isTrue);
      expect(data.flagsCollection.isEnabled, Tristate.isTrue);
      tester.semantics.tap(find.semantics.byLabel('رقم الهاتف'));
      await tester.pump();
      final editable = tester.widget<EditableText>(find.byType(EditableText));
      expect(editable.focusNode.hasFocus, isTrue);

      await pumpPhone(
        tester,
        const ShifaTextField(label: 'العيادة', enabled: false),
      );
      final off = tester
          .getSemantics(find.byType(EditableText))
          .getSemanticsData();
      expect(off.flagsCollection.isEnabled, Tristate.isFalse);
      expect(off.hasAction(SemanticsAction.tap), isFalse);
    });

    testWidgets('one line by default: the keyboard submits', (tester) async {
      final submitted = <String>[];
      await pumpPhone(
        tester,
        ShifaTextField(label: 'الاسم الكامل', onSubmitted: submitted.add),
      );
      final editable = tester.widget<EditableText>(find.byType(EditableText));
      expect(editable.maxLines, 1);
      await tester.enterText(find.byType(EditableText), 'سارة');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      expect(submitted, ['سارة']);
    });

    testWidgets('a caller focus node is given back as it was', (tester) async {
      final node = FocusNode();
      addTearDown(node.dispose);
      await pumpPhone(
        tester,
        ShifaTextField(label: 'العيادة', enabled: false, focusNode: node),
      );
      await pumpPhone(tester, const SizedBox());
      expect(node.canRequestFocus, isTrue);
    });

    testWidgets('dropping the caller controller keeps the text', (
      tester,
    ) async {
      final controller = TextEditingController(text: 'سارة الأحمد');
      addTearDown(controller.dispose);
      // One tree; only the field's controller changes (didUpdateWidget).
      final current = ValueNotifier<TextEditingController?>(controller);
      addTearDown(current.dispose);
      await pumpPhone(
        tester,
        ValueListenableBuilder(
          valueListenable: current,
          builder: (context, c, _) =>
              ShifaTextField(label: 'الاسم', controller: c),
        ),
      );
      current.value = null;
      await tester.pump();
      expect(find.text('سارة الأحمد'), findsOneWidget);
    });
  });

  group('ShifaBottomSheet (review 2, 6, 9)', () {
    Widget opener() => Builder(
      builder: (context) => ShifaButton(
        label: 'افتح',
        onPressed: () => showShifaBottomSheet<void>(
          context,
          title: 'موعد ريم العلي',
          builder: (context) => const SizedBox(height: 300),
        ),
      ),
    );

    testWidgets('the sheet follows the finger', (tester) async {
      await pumpScreen(tester, Center(child: opener()));
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      final top = tester.getTopLeft(find.byType(ShifaBottomSheet)).dy;
      final gesture = await tester.startGesture(
        tester.getCenter(find.text('موعد ريم العلي')),
      );
      await gesture.moveBy(const Offset(0, 20));
      await gesture.moveBy(const Offset(0, 100));
      await tester.pump();
      final moved = tester.getTopLeft(find.byType(ShifaBottomSheet)).dy - top;
      // The finger travelled 120 (the drag gets the slop too): so does the
      // sheet.
      expect(moved, closeTo(120, 2));
      await gesture.up();
      await tester.pumpAndSettle();
    });

    testWidgets('a fling up keeps it open', (tester) async {
      await pumpScreen(tester, Center(child: opener()));
      await tester.tap(find.text('افتح'));
      await tester.pumpAndSettle();
      final height = tester.getSize(find.byType(ShifaBottomSheet)).height;
      // Slowly down past the 0.6 line (alone, a release there would close)…
      final gesture = await tester.startGesture(
        tester.getCenter(find.text('موعد ريم العلي')),
      );
      // Pointer events carry their own times: the velocity comes from them.
      var ms = 0;
      for (var i = 0; i < 20; i++) {
        ms += 50;
        await gesture.moveBy(
          Offset(0, height * 0.6 / 20),
          timeStamp: Duration(milliseconds: ms),
        );
      }
      // …then a quick flick up.
      for (var i = 0; i < 3; i++) {
        ms += 10;
        await gesture.moveBy(
          const Offset(0, -20),
          timeStamp: Duration(milliseconds: ms),
        );
      }
      await gesture.up(timeStamp: Duration(milliseconds: ms + 5));
      await tester.pumpAndSettle();
      expect(find.text('موعد ريم العلي'), findsOneWidget);
    });
  });

  group('ShifaSnackbar (review 3, 4)', () {
    testWidgets('an action may show a follow-up message', (tester) async {
      late BuildContext screen;
      await pumpScreen(
        tester,
        ShifaSnackbarHost(
          child: Builder(
            builder: (context) {
              screen = context;
              return const SizedBox.expand();
            },
          ),
        ),
      );
      ShifaSnackbar.show(
        screen,
        message: 'أُلغي الموعد',
        actionLabel: 'تراجع',
        onAction: () => ShifaSnackbar.show(screen, message: 'أُعيد الموعد'),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('تراجع'));
      await tester.pumpAndSettle();
      expect(find.text('أُعيد الموعد'), findsOneWidget);
    });

    testWidgets('with a screen reader, a message with an action stays', (
      tester,
    ) async {
      late BuildContext screen;
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(accessibleNavigation: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(size: phone, accessibleNavigation: true),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: ShifaTheme(
              data: ShifaThemeData.light(),
              child: ShifaSnackbarHost(
                child: Builder(
                  builder: (context) {
                    screen = context;
                    return const SizedBox.expand();
                  },
                ),
              ),
            ),
          ),
        ),
      );
      ShifaSnackbar.show(
        screen,
        message: 'أُلغي الموعد',
        actionLabel: 'تراجع',
        onAction: () {},
      );
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 10));
      // Let a hide (if any) finish fading out before looking.
      await tester.pumpAndSettle();
      expect(find.text('أُلغي الموعد'), findsOneWidget);
    });
  });

  testWidgets('a disabled row without onPressed is not a button (review 8)', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      const ShifaListItem(title: 'فصيلة الدم', enabled: false),
    );
    final data = tester
        .getSemantics(find.text('فصيلة الدم'))
        .getSemanticsData();
    expect(data.flagsCollection.isButton, isFalse);
  });

  testWidgets(
    'the back arrow is flipped in Arabic, not in English (review 10)',
    (tester) async {
      for (final (direction, flipped) in [
        (TextDirection.rtl, true),
        (TextDirection.ltr, false),
      ]) {
        await tester.pumpWidget(
          Directionality(
            textDirection: direction,
            child: ShifaTheme(
              data: ShifaThemeData.light(),
              child: const Center(child: ShifaGlyph(ShifaGlyphs.arrowBack)),
            ),
          ),
        );
        final flips = find.descendant(
          of: find.byType(ShifaGlyph),
          matching: find.byType(Transform),
        );
        expect(flips.evaluate().isNotEmpty, flipped, reason: direction.name);
        if (flipped) {
          final matrix = tester.widget<Transform>(flips).transform;
          expect(matrix.entry(0, 0), -1);
        }
      }
    },
  );
}
