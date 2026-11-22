import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

void main() {
  group('generated tokens', () {
    test(
      'light colours are the Damascene Jasmine values of the design doc',
      () {
        expect(ShifaColorsLight.colorBgApp, const Color(0xFFFBF8F1));
        expect(ShifaColorsLight.colorTextDefault, const Color(0xFF1D2A26));
        expect(ShifaColorsLight.colorBrandPrimary, const Color(0xFF1F6F5C));
      },
    );

    test('light and dark differ', () {
      expect(ShifaColorsDark.colorBgApp, isNot(ShifaColorsLight.colorBgApp));
      expect(
        ShifaColorsDark.colorTextDefault,
        isNot(ShifaColorsLight.colorTextDefault),
      );
      expect(
        ShifaColorsDark.colorBgApp.computeLuminance(),
        lessThan(ShifaColorsLight.colorBgApp.computeLuminance()),
      );
    });

    test('compact rows are shorter than comfortable ones', () {
      expect(
        ShifaDensityCompact.sizeControlMd,
        lessThan(ShifaDensityComfortable.sizeControlMd),
      );
      expect(ShifaDensityComfortable.sizeControlMd, 44);
      expect(ShifaDensityCompact.sizeControlMd, 32);
    });

    test('shared values have Dart types', () {
      expect(ShifaTokens.space4, isA<double>());
      expect(ShifaTokens.motionDurationFast, isA<Duration>());
      expect(
        ShifaTokens.motionDurationFast.inMilliseconds,
        inInclusiveRange(120, 240),
      );
    });
  });
}
