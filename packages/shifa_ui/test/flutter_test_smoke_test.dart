// Proves flutter_test resolves inside the pub workspace next to the Dart
// client's generators (slice 0.4-08, checkpoint A).
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('pumps Arabic text in a right-to-left tree', (tester) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.rtl,
        child: Text('شفاء'),
      ),
    );

    expect(find.text('شفاء'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('شفاء'))),
      TextDirection.rtl,
    );
  });
}
