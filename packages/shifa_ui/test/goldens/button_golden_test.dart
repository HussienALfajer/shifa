import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support.dart';

const Map<ShifaButtonVariant, String> _labels = {
  ShifaButtonVariant.primary: 'احجز موعداً',
  ShifaButtonVariant.secondary: 'تغيير الموعد',
  ShifaButtonVariant.ghost: 'عرض التفاصيل',
  ShifaButtonVariant.danger: 'إلغاء الموعد',
};

void main() {
  group('ShifaButton', () {
    shifaGoldenTest(
      'variants at rest, disabled and loading, RTL, light and dark',
      fileName: 'button',
      width: 175,
      states: {
        for (final MapEntry(key: variant, value: label) in _labels.entries) ...{
          '${variant.name} · rest': ShifaButton(
            label: label,
            variant: variant,
            onPressed: () {},
          ),
          '${variant.name} · disabled': ShifaButton(
            label: label,
            variant: variant,
            onPressed: null,
          ),
          '${variant.name} · loading': ShifaButton(
            label: label,
            variant: variant,
            loading: true,
            onPressed: () {},
          ),
        },
        'full width with icon': ShifaButton(
          label: 'احجز الموعد',
          variant: ShifaButtonVariant.primary,
          icon: const ShifaGlyph(ShifaGlyphs.calendar),
          expand: true,
          onPressed: () {},
        ),
      },
    );

    shifaGoldenTest(
      'pressed, RTL, light and dark',
      fileName: 'button_pressed',
      width: 175,
      whilePerforming: pressAll(find.byType(ShifaButton)),
      states: {
        for (final MapEntry(key: variant, value: label) in _labels.entries)
          '${variant.name} · pressed': ShifaButton(
            label: label,
            variant: variant,
            onPressed: () {},
          ),
      },
    );

    // One widget holds focus at a time: one image per theme.
    for (final theme in bothThemes) {
      shifaGoldenTest(
        'keyboard focus, RTL, ${theme.$1}',
        fileName: 'button_focused_${theme.$1}',
        width: 175,
        keyboardFocus: true,
        themes: [theme],
        states: {
          'primary · focused': ShifaButton(
            label: 'ادفع',
            variant: ShifaButtonVariant.primary,
            autofocus: true,
            onPressed: () {},
          ),
        },
      );
    }
  });
}
