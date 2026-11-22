import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:shifa_ui/src/generated/tokens.g.dart';

/// The package that declares the fonts (`pubspec.yaml`); a [TextStyle] with
/// this package finds them from any app.
const _fontPackage = 'shifa_ui';

FontWeight _weight(int value) => FontWeight.values[value ~/ 100 - 1];

TextStyle _style(
  List<String> family,
  double size,
  int weight,
  double leading,
) => TextStyle(
  // The first family of the token is the one shifa_ui ships; the rest are
  // CSS fallbacks with no meaning on Flutter.
  fontFamily: family.first,
  package: _fontPackage,
  fontSize: size,
  fontWeight: _weight(weight),
  height: leading,
  leadingDistribution: TextLeadingDistribution.even,
);

/// The named text styles of the design language, from the generated tokens.
/// Sizes are the comfortable (touch) density. Colour is not part of a style:
/// widgets add the colour of their meaning.
@immutable
class ShifaTypography {
  /// Every named style; use [standard].
  const new({
    required this.titleDisplay,
    required this.titleLg,
    required this.titleMd,
    required this.titleSm,
    required this.labelMd,
    required this.labelSm,
    required this.paragraphLg,
    required this.paragraphMd,
    required this.paragraphData,
    required this.paragraphCaption,
    required this.paragraphReading,
  });

  /// The styles of both themes (type does not change with the theme).
  static final standard = ShifaTypography(
    titleDisplay: _style(
      ShifaTokens.textStyleTitleDisplayFamily,
      ShifaTokens.textStyleTitleDisplaySize,
      ShifaTokens.textStyleTitleDisplayWeight,
      ShifaTokens.textStyleTitleDisplayLeading,
    ),
    titleLg: _style(
      ShifaTokens.textStyleTitleLgFamily,
      ShifaTokens.textStyleTitleLgSize,
      ShifaTokens.textStyleTitleLgWeight,
      ShifaTokens.textStyleTitleLgLeading,
    ),
    titleMd: _style(
      ShifaTokens.textStyleTitleMdFamily,
      ShifaTokens.textStyleTitleMdSize,
      ShifaTokens.textStyleTitleMdWeight,
      ShifaTokens.textStyleTitleMdLeading,
    ),
    titleSm: _style(
      ShifaTokens.textStyleTitleSmFamily,
      ShifaTokens.textStyleTitleSmSize,
      ShifaTokens.textStyleTitleSmWeight,
      ShifaTokens.textStyleTitleSmLeading,
    ),
    labelMd: _style(
      ShifaTokens.textStyleLabelMdFamily,
      ShifaDensityComfortable.textStyleLabelMdSize,
      ShifaTokens.textStyleLabelMdWeight,
      ShifaTokens.textStyleLabelMdLeading,
    ),
    labelSm: _style(
      ShifaTokens.textStyleLabelSmFamily,
      ShifaTokens.textStyleLabelSmSize,
      ShifaTokens.textStyleLabelSmWeight,
      ShifaTokens.textStyleLabelSmLeading,
    ),
    paragraphLg: _style(
      ShifaTokens.textStyleParagraphLgFamily,
      ShifaTokens.textStyleParagraphLgSize,
      ShifaTokens.textStyleParagraphLgWeight,
      ShifaTokens.textStyleParagraphLgLeading,
    ),
    paragraphMd: _style(
      ShifaTokens.textStyleParagraphMdFamily,
      ShifaDensityComfortable.textStyleParagraphMdSize,
      ShifaTokens.textStyleParagraphMdWeight,
      ShifaTokens.textStyleParagraphMdLeading,
    ),
    paragraphData: _style(
      ShifaTokens.textStyleParagraphDataFamily,
      ShifaDensityComfortable.textStyleParagraphDataSize,
      ShifaTokens.textStyleParagraphDataWeight,
      ShifaTokens.textStyleParagraphDataLeading,
    ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
    paragraphCaption: _style(
      ShifaTokens.textStyleParagraphCaptionFamily,
      ShifaTokens.textStyleParagraphCaptionSize,
      ShifaTokens.textStyleParagraphCaptionWeight,
      ShifaTokens.textStyleParagraphCaptionLeading,
    ),
    paragraphReading: _style(
      ShifaTokens.textStyleParagraphReadingFamily,
      ShifaTokens.textStyleParagraphReadingSize,
      ShifaTokens.textStyleParagraphReadingWeight,
      ShifaTokens.textStyleParagraphReadingLeading,
    ),
  );

  /// 44/700: queue numbers.
  final TextStyle titleDisplay;

  /// 31/600.
  final TextStyle titleLg;

  /// 25/600.
  final TextStyle titleMd;

  /// 20/600: app bar and sheet titles.
  final TextStyle titleSm;

  /// 16/500: buttons.
  final TextStyle labelMd;

  /// 14/500: field labels, chips.
  final TextStyle labelSm;

  /// 18/400.
  final TextStyle paragraphLg;

  /// 16/400: body text.
  final TextStyle paragraphMd;

  /// 15/400 with tabular digits: dates, times, numbers.
  final TextStyle paragraphData;

  /// 12/400: captions only.
  final TextStyle paragraphCaption;

  /// 18/400 Naskh at 1.8: long reading text.
  final TextStyle paragraphReading;

  List<TextStyle> get _values => [
    titleDisplay,
    titleLg,
    titleMd,
    titleSm,
    labelMd,
    labelSm,
    paragraphLg,
    paragraphMd,
    paragraphData,
    paragraphCaption,
    paragraphReading,
  ];

  /// The styles a fraction [t] of the way to [other].
  ShifaTypography lerp(ShifaTypography other, double t) {
    final a = _values;
    final b = other._values;
    final c = [
      for (var i = 0; i < a.length; i++) TextStyle.lerp(a[i], b[i], t)!,
    ];
    return ShifaTypography(
      titleDisplay: c[0],
      titleLg: c[1],
      titleMd: c[2],
      titleSm: c[3],
      labelMd: c[4],
      labelSm: c[5],
      paragraphLg: c[6],
      paragraphMd: c[7],
      paragraphData: c[8],
      paragraphCaption: c[9],
      paragraphReading: c[10],
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ShifaTypography && listEquals(_values, other._values);

  @override
  int get hashCode => Object.hashAll(_values);
}
