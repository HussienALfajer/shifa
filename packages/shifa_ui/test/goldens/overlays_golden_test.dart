import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import '../support/fixtures.dart';
import 'support.dart';

Widget _sheetOverScreen(BuildContext context) => Stack(
  children: [
    Positioned.fill(child: ColoredBox(color: context.shifa.colors.bgOverlay)),
    Align(
      alignment: Alignment.bottomCenter,
      child: ShifaBottomSheet(
        title: 'موعد ${people[0].name}',
        subtitle: 'الثلاثاء 24/11/2026 · 10:30 · د. نادر الخطيب',
        onClose: () {},
        actions: [
          ShifaButton(
            label: 'تأكيد الحضور',
            variant: ShifaButtonVariant.primary,
            expand: true,
            onPressed: () {},
          ),
          ShifaButton(label: 'لاحقاً', expand: true, onPressed: () {}),
        ],
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ShifaListItem(
              title: 'تغيير الموعد',
              leading: const ShifaGlyph(ShifaGlyphs.calendar),
              trailing: const SizedBox.shrink(),
              onPressed: () {},
            ),
            ShifaListItem(
              title: 'ذكّرني قبل ساعة',
              leading: const ShifaGlyph(ShifaGlyphs.bell),
              trailing: const SizedBox.shrink(),
              onPressed: () {},
            ),
          ],
        ),
      ),
    ),
  ],
);

void main() {
  group('ShifaBottomSheet', () {
    shifaGoldenTest(
      'over a scrim, RTL, light and dark',
      fileName: 'bottom_sheet',
      width: 390,
      height: 560,
      states: {'open': const Builder(builder: _sheetOverScreen)},
    );
  });

  group('ShifaSnackbar', () {
    shifaGoldenTest(
      'tones, RTL, light and dark',
      fileName: 'snackbar',
      states: {
        'neutral with action': ShifaSnackbar(
          message: 'أُلغي موعد الخميس 26/11/2026',
          actionLabel: 'تراجع',
          onAction: () {},
        ),
        'success': const ShifaSnackbar(
          message: 'تم حجز موعدك',
          tone: ShifaSnackbarTone.success,
        ),
        'error stays until closed': ShifaSnackbar(
          message: 'تعذّر الاتصال. تحقق من الإنترنت',
          tone: ShifaSnackbarTone.error,
          onClose: () {},
        ),
      },
    );
  });
}
