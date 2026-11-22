// ShifaBottomSheet: a sheet that rises over a scrim (slice 0.4-08,
// criterion 10).
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

/// A screen with one button that opens a sheet and keeps what it returns.
class _Opener extends StatelessWidget {
  const new(this.results, {this.rows = 4});

  /// Where results go; null when the test does not read them.
  final List<String?>? results;
  final int rows;

  @override
  Widget build(BuildContext context) => Center(
    child: ShifaButton(
      label: 'افتح',
      onPressed: () async {
        final result = await showShifaBottomSheet<String>(
          context,
          title: 'موعد ريم العلي',
          subtitle: 'الثلاثاء 24/11/2026 · 10:30',
          builder: (context) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < rows; i++)
                ShifaListItem(
                  title: 'خيار ${i + 1}',
                  onPressed: () => Navigator.of(context).pop('خيار ${i + 1}'),
                ),
            ],
          ),
        );
        results?.add(result);
      },
    ),
  );
}

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('افتح'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('opens with its title; a row returns its value', (tester) async {
    final results = <String?>[];
    await pumpScreen(tester, _Opener(results));
    await _open(tester);
    expect(find.text('موعد ريم العلي'), findsOneWidget);
    await tester.tap(find.text('خيار 2'));
    await tester.pumpAndSettle();
    expect(find.text('موعد ريم العلي'), findsNothing);
    expect(results, ['خيار 2']);
  });

  testWidgets('the close button, the grabber and the scrim close it', (
    tester,
  ) async {
    final results = <String?>[];
    await pumpScreen(tester, _Opener(results));

    await _open(tester);
    await tester.tap(find.bySemanticsLabel('إغلاق'));
    await tester.pumpAndSettle();
    expect(find.text('موعد ريم العلي'), findsNothing);

    await _open(tester);
    await tester.tap(find.bySemanticsLabel('اسحب للإغلاق'));
    await tester.pumpAndSettle();
    expect(find.text('موعد ريم العلي'), findsNothing);

    await _open(tester);
    await tester.tapAt(const Offset(195, 40));
    await tester.pumpAndSettle();
    expect(find.text('موعد ريم العلي'), findsNothing);
    expect(results, [null, null, null]);
  });

  testWidgets('a drag down closes it', (tester) async {
    final results = <String?>[];
    await pumpScreen(tester, _Opener(results));
    await _open(tester);
    await tester.drag(find.text('موعد ريم العلي'), const Offset(0, 300));
    await tester.pumpAndSettle();
    expect(find.text('موعد ريم العلي'), findsNothing);
  });

  testWidgets('never taller than 5/6 of the screen; scrolls inside', (
    tester,
  ) async {
    await pumpScreen(tester, const _Opener(null, rows: 30));
    await _open(tester);
    final sheet = tester.getRect(find.byType(ShifaBottomSheet));
    expect(sheet.height, lessThanOrEqualTo(844 * 5 / 6 + 0.5));
    expect(sheet.bottom, 844);
    expect(find.byType(Scrollable), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('it is a modal route named by its title', (tester) async {
    await pumpScreen(tester, const _Opener(null));
    await _open(tester);
    final data = tester
        .getSemantics(find.byType(ShifaBottomSheet))
        .getSemanticsData();
    expect(data.flagsCollection.scopesRoute, isTrue);
    expect(data.flagsCollection.namesRoute, isTrue);
    expect(data.label, contains('موعد ريم العلي'));
  });

  testWidgets('rises in 240 ms; at once under reduced motion', (tester) async {
    await pumpScreen(tester, const _Opener(null));
    await tester.tap(find.text('افتح'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));
    final halfway = tester.getRect(find.byType(ShifaBottomSheet)).bottom;
    expect(halfway, greaterThan(844));
    await tester.pump(const Duration(milliseconds: 130));
    expect(tester.getRect(find.byType(ShifaBottomSheet)).bottom, 844);

    await pumpScreen(tester, const _Opener(null), reduceMotion: true);
    await tester.tap(find.text('افتح'));
    await tester.pump();
    await tester.pump();
    expect(tester.getRect(find.byType(ShifaBottomSheet)).bottom, 844);
  });
}
