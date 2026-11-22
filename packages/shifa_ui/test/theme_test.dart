// The theme carries the generated token values, never hand-typed ones
// (slice 0.4-08, criterion 10).
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

void main() {
  final light = ShifaThemeData.light();
  final dark = ShifaThemeData.dark();

  group('ShifaThemeData', () {
    test('light and dark differ and carry their brightness', () {
      expect(light.brightness, Brightness.light);
      expect(dark.brightness, Brightness.dark);
      expect(light, isNot(dark));
      expect(ShifaThemeData.light(), light);
    });

    test('colours are the generated constants of each theme', () {
      expect(light.colors.bgApp, ShifaColorsLight.colorBgApp);
      expect(dark.colors.bgApp, ShifaColorsDark.colorBgApp);
      expect(light.colors.bgSurface, ShifaColorsLight.colorBgSurface);
      expect(dark.colors.bgSurface, ShifaColorsDark.colorBgSurface);
      expect(light.colors.textDefault, ShifaColorsLight.colorTextDefault);
      expect(dark.colors.textDefault, ShifaColorsDark.colorTextDefault);
      expect(light.colors.textMuted, ShifaColorsLight.colorTextMuted);
      expect(light.colors.textDisabled, ShifaColorsLight.colorTextDisabled);
      expect(light.colors.borderDefault, ShifaColorsLight.colorBorderDefault);
      expect(dark.colors.borderFocus, ShifaColorsDark.colorBorderFocus);
      expect(light.colors.brandPrimary, ShifaColorsLight.colorBrandPrimary);
      expect(dark.colors.brandPrimary, ShifaColorsDark.colorBrandPrimary);
      expect(light.colors.buttonPrimaryBg, ShifaColorsLight.buttonPrimaryBg);
      expect(dark.colors.buttonPrimaryFg, ShifaColorsDark.buttonPrimaryFg);
      expect(light.colors.inputBorder, ShifaColorsLight.inputBorder);
      expect(dark.colors.cardBg, ShifaColorsDark.cardBg);
      expect(light.colors.bgOverlay, ShifaColorsLight.colorBgOverlay);
      expect(
        light.colors.selectionSubtle,
        ShifaColorsLight.colorSelectionSubtle,
      );
    });

    test('status colours are the locked tokens', () {
      expect(light.status.danger.fg, ShifaColorsLight.colorStatusDangerFg);
      expect(dark.status.danger.solid, ShifaColorsDark.colorStatusDangerSolid);
      expect(
        light.status.success.onSolid,
        ShifaColorsLight.colorStatusSuccessOnSolid,
      );
      expect(light.status.info.bg, ShifaColorsLight.colorStatusInfoBg);
      expect(
        dark.status.warning.border,
        ShifaColorsDark.colorStatusWarningBorder,
      );
      expect(light.status.neutral.fg, ShifaColorsLight.colorStatusNeutralFg);
      expect(
        light.status.queueConfirmed.fg,
        ShifaColorsLight.colorQueueConfirmedFg,
      );
      expect(dark.status.queueDone.bg, ShifaColorsDark.colorQueueDoneBg);
      expect(
        light.status.alertCritical.fg,
        ShifaColorsLight.colorAlertCriticalFg,
      );
    });

    test('typography, spacing, shapes and motion come from the tokens', () {
      final type = light.typography;
      expect(type.titleSm.fontSize, ShifaTokens.textStyleTitleSmSize);
      expect(type.titleSm.height, ShifaTokens.textStyleTitleSmLeading);
      expect(type.titleSm.fontWeight, FontWeight.w600);
      expect(type.titleSm.fontFamily, 'packages/shifa_ui/Shifa Sans Arabic');
      expect(
        type.labelMd.fontSize,
        ShifaDensityComfortable.textStyleLabelMdSize,
      );
      expect(
        type.paragraphMd.fontSize,
        ShifaDensityComfortable.textStyleParagraphMdSize,
      );
      expect(type.paragraphReading.fontFamily, contains('Noto Naskh Arabic'));
      expect(dark.typography, light.typography);

      expect(light.spacing.space4, ShifaTokens.space4);
      expect(light.spacing.insetSurface, ShifaDensityComfortable.insetSurface);
      expect(light.spacing.touchTarget, 48);

      expect(light.shapes.radiusControl, ShifaTokens.shapeRadiusControl);
      expect(light.shapes.radiusOverlay, ShifaTokens.shapeRadiusOverlay);
      expect(light.shapes.borderFocus, ShifaTokens.shapeBorderFocus);
      expect(light.shapes.shadowCard.single.blurRadius, 2);

      expect(light.motion.fast, ShifaTokens.motionDurationFast);
      expect(light.motion.slow, ShifaTokens.motionDurationSlow);
      // Cubic has no value equality: compare its four control points.
      final standard = light.motion.standard;
      expect([
        standard.a,
        standard.b,
        standard.c,
        standard.d,
      ], ShifaTokens.motionEasingStandard);
    });

    test('lerp goes from light to dark', () {
      final start = light.lerp(dark, 0);
      final end = light.lerp(dark, 1);
      final middle = light.lerp(dark, 0.5);
      expect(start.colors.bgApp, light.colors.bgApp);
      expect(end.colors.bgApp, dark.colors.bgApp);
      expect(end.status.danger.fg, dark.status.danger.fg);
      expect(
        middle.colors.bgApp,
        Color.lerp(light.colors.bgApp, dark.colors.bgApp, 0.5),
      );
      expect(end.brightness, Brightness.dark);
    });
  });

  group('ShifaTheme', () {
    testWidgets('context.shifa reads the nearest theme', (tester) async {
      late ShifaThemeData seen;
      late TextStyle text;
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.rtl,
          child: ShifaTheme(
            data: dark,
            child: Builder(
              builder: (context) {
                seen = context.shifa;
                text = DefaultTextStyle.of(context).style;
                return const SizedBox();
              },
            ),
          ),
        ),
      );
      expect(seen, dark);
      expect(text.color, dark.colors.textDefault);
      expect(text.fontFamily, dark.typography.paragraphMd.fontFamily);
    });

    testWidgets('without a theme, context.shifa says what is missing', (
      tester,
    ) async {
      late BuildContext outside;
      await tester.pumpWidget(
        Builder(
          builder: (context) {
            outside = context;
            return const SizedBox();
          },
        ),
      );
      expect(
        () => outside.shifa,
        throwsA(
          isA<FlutterError>().having(
            (e) => e.toString(),
            'message',
            contains('ShifaTheme'),
          ),
        ),
      );
    });
  });
}
