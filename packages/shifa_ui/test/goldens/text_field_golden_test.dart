import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support.dart';

void main() {
  group('ShifaTextField', () {
    shifaGoldenTest(
      'states in RTL, light and dark',
      fileName: 'text_field',
      states: {
        'empty with placeholder': const ShifaTextField(
          label: 'الاسم الكامل',
          placeholder: 'كما في الهوية',
        ),
        'filled': ShifaTextField(
          label: 'الاسم الكامل',
          controller: TextEditingController(text: 'سارة الأحمد'),
        ),
        'digits with helper': ShifaTextField(
          label: 'رقم الهاتف',
          keyboardType: TextInputType.phone,
          helper: 'سنرسل رمز التأكيد إلى هذا الرقم',
          controller: TextEditingController(text: '0944123456'),
        ),
        'error': ShifaTextField(
          label: 'تاريخ الميلاد',
          error: 'هذا التاريخ غير موجود',
          controller: TextEditingController(text: '31/02/1990'),
        ),
        'disabled': ShifaTextField(
          label: 'العيادة',
          enabled: false,
          controller: TextEditingController(text: 'عيادة الشهباء لطب الأسنان'),
        ),
      },
    );

    // One field holds focus at a time: one image per theme.
    for (final theme in bothThemes) {
      shifaGoldenTest(
        'focused, RTL, ${theme.$1}',
        fileName: 'text_field_focused_${theme.$1}',
        themes: [theme],
        states: {
          'focused': ShifaTextField(
            label: 'الاسم الكامل',
            autofocus: true,
            controller: TextEditingController(text: 'سارة الأحمد'),
          ),
        },
      );
    }
  });
}
