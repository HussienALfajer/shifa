// ShifaTextField: label, digits (OD-20), error, disabled, text scale
// (slice 0.4-08, criterion 10).
import 'dart:ui' show SemanticsValidationResult;

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support/harness.dart';

void main() {
  testWidgets('Arabic-Indic digits typed are shown and returned as Western', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    final changes = <String>[];
    await pumpPhone(
      tester,
      ShifaTextField(
        label: 'رقم الهاتف',
        controller: controller,
        keyboardType: TextInputType.phone,
        onChanged: changes.add,
      ),
    );
    await tester.enterText(find.byType(EditableText), '٠٩٤٤١٢٣٤٥٦');
    expect(controller.text, '0944123456');
    expect(changes.last, '0944123456');
    expect(find.text('0944123456'), findsOneWidget);
    await tester.enterText(find.byType(EditableText), '۰۹۴۴'); // Persian digits
    expect(controller.text, '0944');
  });

  test('the digits formatter keeps the caret and other characters', () {
    const formatter = ShifaWesternDigitsFormatter();
    final out = formatter.formatEditUpdate(
      TextEditingValue.empty,
      const TextEditingValue(
        text: 'غرفة ٣ب',
        selection: TextSelection.collapsed(offset: 6),
      ),
    );
    expect(out.text, 'غرفة 3ب');
    expect(out.selection, const TextSelection.collapsed(offset: 6));
  });

  testWidgets('the label names the field; the box is at least 48 tall', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      const ShifaTextField(label: 'الاسم الكامل', placeholder: 'كما في الهوية'),
    );
    expect(find.text('الاسم الكامل'), findsOneWidget);
    expect(find.text('كما في الهوية'), findsOneWidget);
    final data = tester
        .getSemantics(find.byType(EditableText))
        .getSemanticsData();
    expect(data.label, contains('الاسم الكامل'));
    expect(
      tester.getSize(find.byKey(ShifaTextField.boxKey)).height,
      greaterThanOrEqualTo(48),
    );
  });

  testWidgets('a tap on the label or the box focuses the field', (
    tester,
  ) async {
    await pumpPhone(tester, const ShifaTextField(label: 'الاسم الكامل'));
    await tester.tap(find.text('الاسم الكامل'));
    await tester.pump();
    final editable = tester.widget<EditableText>(find.byType(EditableText));
    expect(editable.focusNode.hasFocus, isTrue);
  });

  testWidgets('an error is shown in words and announced as invalid', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      const ShifaTextField(
        label: 'تاريخ الميلاد',
        helper: 'يوم/شهر/سنة',
        error: 'هذا التاريخ غير موجود',
      ),
    );
    expect(find.text('هذا التاريخ غير موجود'), findsOneWidget);
    expect(find.text('يوم/شهر/سنة'), findsNothing);
    final data = tester
        .getSemantics(find.byType(EditableText))
        .getSemanticsData();
    expect(data.validationResult, SemanticsValidationResult.invalid);
    expect(data.hint, contains('هذا التاريخ غير موجود'));
  });

  testWidgets('disabled: no focus, no typing', (tester) async {
    final controller = TextEditingController(text: 'عيادة الشهباء');
    addTearDown(controller.dispose);
    await pumpPhone(
      tester,
      ShifaTextField(label: 'العيادة', controller: controller, enabled: false),
    );
    await tester.tap(find.byType(ShifaTextField), warnIfMissed: false);
    await tester.pump();
    final editable = tester.widget<EditableText>(find.byType(EditableText));
    expect(editable.focusNode.hasFocus, isFalse);
    expect(editable.readOnly, isTrue);
  });

  testWidgets('at 200 % text the label wraps and nothing overflows', (
    tester,
  ) async {
    await pumpPhone(
      tester,
      const ShifaTextField(
        label: 'ملاحظة للطبيب قبل الموعد عن الأعراض',
        placeholder: 'اختياري',
        helper: 'يقرؤها الطبيب فقط',
      ),
      textScale: 2,
    );
    expect(tester.takeException(), isNull);
  });
}
