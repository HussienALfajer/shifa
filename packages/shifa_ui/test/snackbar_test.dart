// ShifaSnackbar: one short message at the bottom (slice 0.4-08, criterion 10).
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

/// A screen inside a snackbar host; [onReady] gets a context below the host.
Future<void> _host(WidgetTester tester, void Function(BuildContext) onReady) =>
    pumpScreen(
      tester,
      ShifaSnackbarHost(
        child: Builder(
          builder: (context) {
            onReady(context);
            return const SizedBox.expand();
          },
        ),
      ),
    );

void main() {
  testWidgets('shows a message and hides it after 4 seconds', (tester) async {
    late BuildContext screen;
    await _host(tester, (c) => screen = c);
    ShifaSnackbar.show(
      screen,
      message: 'تم حجز موعدك',
      tone: ShifaSnackbarTone.success,
    );
    await tester.pumpAndSettle();
    expect(find.text('تم حجز موعدك'), findsOneWidget);
    expect(find.byType(ShifaGlyph), findsOneWidget, reason: 'a status icon');
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(find.text('تم حجز موعدك'), findsNothing);
  });

  testWidgets('an error stays until it is closed', (tester) async {
    late BuildContext screen;
    await _host(tester, (c) => screen = c);
    ShifaSnackbar.show(
      screen,
      message: 'تعذّر الاتصال. تحقق من الإنترنت',
      tone: ShifaSnackbarTone.error,
    );
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 30));
    expect(find.text('تعذّر الاتصال. تحقق من الإنترنت'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('إغلاق'));
    await tester.pumpAndSettle();
    expect(find.text('تعذّر الاتصال. تحقق من الإنترنت'), findsNothing);
  });

  testWidgets('the action runs and closes the message', (tester) async {
    late BuildContext screen;
    var undone = 0;
    await _host(tester, (c) => screen = c);
    ShifaSnackbar.show(
      screen,
      message: 'أُلغي موعد الخميس',
      actionLabel: 'تراجع',
      onAction: () => undone++,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('تراجع'));
    await tester.pumpAndSettle();
    expect(undone, 1);
    expect(find.text('أُلغي موعد الخميس'), findsNothing);
  });

  testWidgets('a new message replaces the one shown', (tester) async {
    late BuildContext screen;
    await _host(tester, (c) => screen = c);
    ShifaSnackbar.show(screen, message: 'الأولى');
    await tester.pumpAndSettle();
    ShifaSnackbar.show(screen, message: 'الثانية');
    await tester.pumpAndSettle();
    expect(find.text('الأولى'), findsNothing);
    expect(find.text('الثانية'), findsOneWidget);
  });

  testWidgets('it is a live region at the bottom, 16 from each side', (
    tester,
  ) async {
    late BuildContext screen;
    await _host(tester, (c) => screen = c);
    ShifaSnackbar.show(screen, message: 'تم حجز موعدك');
    await tester.pumpAndSettle();
    final data = tester
        .getSemantics(find.text('تم حجز موعدك'))
        .getSemanticsData();
    expect(data.flagsCollection.isLiveRegion, isTrue);
    final rect = tester.getRect(find.byType(ShifaSnackbar));
    expect(rect.left, 16);
    expect(rect.right, 390 - 16);
    expect(rect.bottom, lessThanOrEqualTo(844 - 16));
    expect(rect.height, greaterThanOrEqualTo(48));
  });

  testWidgets('without a host, show says what is missing', (tester) async {
    late BuildContext screen;
    await pumpScreen(
      tester,
      Builder(
        builder: (context) {
          screen = context;
          return const SizedBox();
        },
      ),
    );
    expect(
      () => ShifaSnackbar.show(screen, message: 'x'),
      throwsA(
        isA<FlutterError>().having(
          (e) => e.toString(),
          'message',
          contains('ShifaSnackbarHost'),
        ),
      ),
    );
  });
}
