import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:shifa_ui/src/generated/tokens.g.dart';

/// The semantic, brand and component colours of one theme, taken from the
/// generated tokens (`ShifaColorsLight`, `ShifaColorsDark`). Widgets draw with
/// these meanings, never with a palette step or a literal colour.
@immutable
class ShifaColors {
  /// Every colour of a theme; use [light] or [dark].
  const new({
    required this.bgApp,
    required this.bgSurface,
    required this.bgSurfaceRaised,
    required this.bgOverlay,
    required this.textDefault,
    required this.textMuted,
    required this.textDisabled,
    required this.iconDefault,
    required this.iconMuted,
    required this.borderDefault,
    required this.borderStrong,
    required this.borderFocus,
    required this.selectionSubtle,
    required this.selectionDefault,
    required this.selectionStrong,
    required this.brandPrimary,
    required this.brandPrimaryPressed,
    required this.brandOnPrimary,
    required this.brandPrimarySoft,
    required this.brandAccent,
    required this.buttonPrimaryBg,
    required this.buttonPrimaryBgPressed,
    required this.buttonPrimaryFg,
    required this.inputBg,
    required this.inputFg,
    required this.inputBorder,
    required this.cardBg,
    required this.cardBorder,
  });

  /// The colours of the light theme.
  static const light = ShifaColors(
    bgApp: ShifaColorsLight.colorBgApp,
    bgSurface: ShifaColorsLight.colorBgSurface,
    bgSurfaceRaised: ShifaColorsLight.colorBgSurfaceRaised,
    bgOverlay: ShifaColorsLight.colorBgOverlay,
    textDefault: ShifaColorsLight.colorTextDefault,
    textMuted: ShifaColorsLight.colorTextMuted,
    textDisabled: ShifaColorsLight.colorTextDisabled,
    iconDefault: ShifaColorsLight.colorIconDefault,
    iconMuted: ShifaColorsLight.colorIconMuted,
    borderDefault: ShifaColorsLight.colorBorderDefault,
    borderStrong: ShifaColorsLight.colorBorderStrong,
    borderFocus: ShifaColorsLight.colorBorderFocus,
    selectionSubtle: ShifaColorsLight.colorSelectionSubtle,
    selectionDefault: ShifaColorsLight.colorSelectionDefault,
    selectionStrong: ShifaColorsLight.colorSelectionStrong,
    brandPrimary: ShifaColorsLight.colorBrandPrimary,
    brandPrimaryPressed: ShifaColorsLight.colorBrandPrimaryPressed,
    brandOnPrimary: ShifaColorsLight.colorBrandOnPrimary,
    brandPrimarySoft: ShifaColorsLight.colorBrandPrimarySoft,
    brandAccent: ShifaColorsLight.colorBrandAccent,
    buttonPrimaryBg: ShifaColorsLight.buttonPrimaryBg,
    buttonPrimaryBgPressed: ShifaColorsLight.buttonPrimaryBgPressed,
    buttonPrimaryFg: ShifaColorsLight.buttonPrimaryFg,
    inputBg: ShifaColorsLight.inputBg,
    inputFg: ShifaColorsLight.inputFg,
    inputBorder: ShifaColorsLight.inputBorder,
    cardBg: ShifaColorsLight.cardBg,
    cardBorder: ShifaColorsLight.cardBorder,
  );

  /// The colours of the dark theme.
  static const dark = ShifaColors(
    bgApp: ShifaColorsDark.colorBgApp,
    bgSurface: ShifaColorsDark.colorBgSurface,
    bgSurfaceRaised: ShifaColorsDark.colorBgSurfaceRaised,
    bgOverlay: ShifaColorsDark.colorBgOverlay,
    textDefault: ShifaColorsDark.colorTextDefault,
    textMuted: ShifaColorsDark.colorTextMuted,
    textDisabled: ShifaColorsDark.colorTextDisabled,
    iconDefault: ShifaColorsDark.colorIconDefault,
    iconMuted: ShifaColorsDark.colorIconMuted,
    borderDefault: ShifaColorsDark.colorBorderDefault,
    borderStrong: ShifaColorsDark.colorBorderStrong,
    borderFocus: ShifaColorsDark.colorBorderFocus,
    selectionSubtle: ShifaColorsDark.colorSelectionSubtle,
    selectionDefault: ShifaColorsDark.colorSelectionDefault,
    selectionStrong: ShifaColorsDark.colorSelectionStrong,
    brandPrimary: ShifaColorsDark.colorBrandPrimary,
    brandPrimaryPressed: ShifaColorsDark.colorBrandPrimaryPressed,
    brandOnPrimary: ShifaColorsDark.colorBrandOnPrimary,
    brandPrimarySoft: ShifaColorsDark.colorBrandPrimarySoft,
    brandAccent: ShifaColorsDark.colorBrandAccent,
    buttonPrimaryBg: ShifaColorsDark.buttonPrimaryBg,
    buttonPrimaryBgPressed: ShifaColorsDark.buttonPrimaryBgPressed,
    buttonPrimaryFg: ShifaColorsDark.buttonPrimaryFg,
    inputBg: ShifaColorsDark.inputBg,
    inputFg: ShifaColorsDark.inputFg,
    inputBorder: ShifaColorsDark.inputBorder,
    cardBg: ShifaColorsDark.cardBg,
    cardBorder: ShifaColorsDark.cardBorder,
  );

  /// The screen behind everything.
  final Color bgApp;

  /// Cards, sheets and fields.
  final Color bgSurface;

  /// A surface one step up, and disabled controls.
  final Color bgSurfaceRaised;

  /// The scrim behind a bottom sheet.
  final Color bgOverlay;

  /// Text on every surface.
  final Color textDefault;

  /// Hints and metadata.
  final Color textMuted;

  /// Text inside a disabled control only.
  final Color textDisabled;

  /// Icons in rows and controls.
  final Color iconDefault;

  /// Quiet icons.
  final Color iconMuted;

  /// Card and divider lines.
  final Color borderDefault;

  /// Control outlines.
  final Color borderStrong;

  /// The focus outline.
  final Color borderFocus;

  /// A pressed row or card.
  final Color selectionSubtle;

  /// A selected item, a pressed light button.
  final Color selectionDefault;

  /// Selected and pressed.
  final Color selectionStrong;

  /// The primary action, links, the selected item's mark.
  final Color brandPrimary;

  /// The primary colour while pressed.
  final Color brandPrimaryPressed;

  /// Text and icons on [brandPrimary].
  final Color brandOnPrimary;

  /// A soft brand fill.
  final Color brandPrimarySoft;

  /// Gold: a fill, ring or mark, never body text on a light surface.
  final Color brandAccent;

  /// The primary button's fill.
  final Color buttonPrimaryBg;

  /// The primary button's fill while pressed.
  final Color buttonPrimaryBgPressed;

  /// The primary button's label.
  final Color buttonPrimaryFg;

  /// A text field's fill.
  final Color inputBg;

  /// A text field's text.
  final Color inputFg;

  /// A text field's outline.
  final Color inputBorder;

  /// A card's fill.
  final Color cardBg;

  /// A card's outline.
  final Color cardBorder;

  List<Color> get _values => [
    bgApp,
    bgSurface,
    bgSurfaceRaised,
    bgOverlay,
    textDefault,
    textMuted,
    textDisabled,
    iconDefault,
    iconMuted,
    borderDefault,
    borderStrong,
    borderFocus,
    selectionSubtle,
    selectionDefault,
    selectionStrong,
    brandPrimary,
    brandPrimaryPressed,
    brandOnPrimary,
    brandPrimarySoft,
    brandAccent,
    buttonPrimaryBg,
    buttonPrimaryBgPressed,
    buttonPrimaryFg,
    inputBg,
    inputFg,
    inputBorder,
    cardBg,
    cardBorder,
  ];

  /// The colours a fraction [t] of the way from these to [other].
  ShifaColors lerp(ShifaColors other, double t) {
    final a = _values;
    final b = other._values;
    final c = [for (var i = 0; i < a.length; i++) Color.lerp(a[i], b[i], t)!];
    var i = 0;
    Color next() => c[i++];
    return ShifaColors(
      bgApp: next(),
      bgSurface: next(),
      bgSurfaceRaised: next(),
      bgOverlay: next(),
      textDefault: next(),
      textMuted: next(),
      textDisabled: next(),
      iconDefault: next(),
      iconMuted: next(),
      borderDefault: next(),
      borderStrong: next(),
      borderFocus: next(),
      selectionSubtle: next(),
      selectionDefault: next(),
      selectionStrong: next(),
      brandPrimary: next(),
      brandPrimaryPressed: next(),
      brandOnPrimary: next(),
      brandPrimarySoft: next(),
      brandAccent: next(),
      buttonPrimaryBg: next(),
      buttonPrimaryBgPressed: next(),
      buttonPrimaryFg: next(),
      inputBg: next(),
      inputFg: next(),
      inputBorder: next(),
      cardBg: next(),
      cardBorder: next(),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ShifaColors && listEquals(_values, other._values);

  @override
  int get hashCode => Object.hashAll(_values);
}
