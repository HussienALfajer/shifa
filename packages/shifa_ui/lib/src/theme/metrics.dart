import 'dart:ui' show lerpDouble;

import 'package:flutter/animation.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter/widgets.dart' show BuildContext, MediaQuery;
import 'package:shifa_ui/src/generated/tokens.g.dart';

double _lerp(double a, double b, double t) => lerpDouble(a, b, t)!;

/// The 4 px spacing scale and the touch insets, from the generated tokens.
@immutable
class ShifaSpacing {
  /// The spacing of the comfortable (touch) density.
  const new({
    this.space05 = ShifaTokens.space05,
    this.space1 = ShifaTokens.space1,
    this.space2 = ShifaTokens.space2,
    this.space3 = ShifaTokens.space3,
    this.space4 = ShifaTokens.space4,
    this.space5 = ShifaTokens.space5,
    this.space6 = ShifaTokens.space6,
    this.space8 = ShifaTokens.space8,
    this.space12 = ShifaTokens.space12,
    this.insetControl = ShifaDensityComfortable.insetControl,
    this.insetSurface = ShifaDensityComfortable.insetSurface,
    this.gapStack = ShifaDensityComfortable.gapStack,
    this.gapInline = ShifaTokens.gapInline,
    this.touchTarget = ShifaTokens.space12,
  });

  /// 2.
  final double space05;

  /// 4.
  final double space1;

  /// 8.
  final double space2;

  /// 12.
  final double space3;

  /// 16: the screen margin on a phone.
  final double space4;

  /// 20.
  final double space5;

  /// 24.
  final double space6;

  /// 32.
  final double space8;

  /// 48.
  final double space12;

  /// The inline padding of a control.
  final double insetControl;

  /// The padding of a card or sheet.
  final double insetSurface;

  /// The gap between stacked fields.
  final double gapStack;

  /// The gap between an icon and its label.
  final double gapInline;

  /// The smallest touch target: 48 dp (Android's rule; the web's 44 px
  /// `size.target.min` is for pointer and touch screens alike).
  final double touchTarget;

  List<double> get _values => [
    space05,
    space1,
    space2,
    space3,
    space4,
    space5,
    space6,
    space8,
    space12,
    insetControl,
    insetSurface,
    gapStack,
    gapInline,
    touchTarget,
  ];

  /// The spacing a fraction [t] of the way to [other].
  ShifaSpacing lerp(ShifaSpacing other, double t) {
    final a = _values;
    final b = other._values;
    final c = [for (var i = 0; i < a.length; i++) _lerp(a[i], b[i], t)];
    return ShifaSpacing(
      space05: c[0],
      space1: c[1],
      space2: c[2],
      space3: c[3],
      space4: c[4],
      space5: c[5],
      space6: c[6],
      space8: c[7],
      space12: c[8],
      insetControl: c[9],
      insetSurface: c[10],
      gapStack: c[11],
      gapInline: c[12],
      touchTarget: c[13],
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ShifaSpacing && listEquals(_values, other._values);

  @override
  int get hashCode => Object.hashAll(_values);
}

List<BoxShadow> _shadow(List<ShifaShadowLayer> layers) => [
  for (final layer in layers)
    BoxShadow(
      color: layer.color,
      offset: Offset(layer.dx, layer.dy),
      blurRadius: layer.blur,
      spreadRadius: layer.spread,
    ),
];

/// Radii, borders and shadows, from the generated tokens.
@immutable
class ShifaShapes {
  /// The shapes of the design language; use [standard].
  const new({
    required this.radiusMark,
    required this.radiusInput,
    required this.radiusControl,
    required this.radiusSurface,
    required this.radiusOverlay,
    required this.radiusPill,
    required this.borderDefault,
    required this.borderFocus,
    required this.shadowCard,
    required this.shadowDropdown,
    required this.shadowModal,
    required this.shadowFocus,
  });

  /// The shapes of both themes.
  static final standard = ShifaShapes(
    radiusMark: ShifaTokens.shapeRadiusMark,
    radiusInput: ShifaTokens.shapeRadiusInput,
    radiusControl: ShifaTokens.shapeRadiusControl,
    radiusSurface: ShifaTokens.shapeRadiusSurface,
    radiusOverlay: ShifaTokens.shapeRadiusOverlay,
    radiusPill: ShifaTokens.shapeRadiusPill,
    borderDefault: ShifaTokens.shapeBorderDefault,
    borderFocus: ShifaTokens.shapeBorderFocus,
    shadowCard: _shadow(ShifaTokens.shadowCard),
    shadowDropdown: _shadow(ShifaTokens.shadowDropdown),
    shadowModal: _shadow(ShifaTokens.shadowModal),
    shadowFocus: _shadow(ShifaTokens.shadowFocus),
  );

  /// 4: small marks.
  final double radiusMark;

  /// 8: fields and chips.
  final double radiusInput;

  /// 12: buttons.
  final double radiusControl;

  /// 12: cards.
  final double radiusSurface;

  /// 16: sheets and dialogs.
  final double radiusOverlay;

  /// Full: status pills.
  final double radiusPill;

  /// 1: outlines.
  final double borderDefault;

  /// 2: the focus outline and an error outline.
  final double borderFocus;

  /// A card's small soft shadow.
  final List<BoxShadow> shadowCard;

  /// One level higher: snackbars.
  final List<BoxShadow> shadowDropdown;

  /// Sheets.
  final List<BoxShadow> shadowModal;

  /// The halo outside a focus outline.
  final List<BoxShadow> shadowFocus;

  List<double> get _sizes => [
    radiusMark,
    radiusInput,
    radiusControl,
    radiusSurface,
    radiusOverlay,
    radiusPill,
    borderDefault,
    borderFocus,
  ];

  List<List<BoxShadow>> get _shadows => [
    shadowCard,
    shadowDropdown,
    shadowModal,
    shadowFocus,
  ];

  /// The shapes a fraction [t] of the way to [other].
  ShifaShapes lerp(ShifaShapes other, double t) {
    final a = _sizes;
    final b = other._sizes;
    final c = [for (var i = 0; i < a.length; i++) _lerp(a[i], b[i], t)];
    final s = [
      for (var i = 0; i < _shadows.length; i++)
        BoxShadow.lerpList(_shadows[i], other._shadows[i], t)!,
    ];
    return ShifaShapes(
      radiusMark: c[0],
      radiusInput: c[1],
      radiusControl: c[2],
      radiusSurface: c[3],
      radiusOverlay: c[4],
      radiusPill: c[5],
      borderDefault: c[6],
      borderFocus: c[7],
      shadowCard: s[0],
      shadowDropdown: s[1],
      shadowModal: s[2],
      shadowFocus: s[3],
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ShifaShapes &&
      listEquals(_sizes, other._sizes) &&
      listEquals(
        _shadows.expand((s) => s).toList(),
        other._shadows.expand((s) => s).toList(),
      );

  @override
  int get hashCode => Object.hash(
    Object.hashAll(_sizes),
    Object.hashAll(_shadows.expand((s) => s)),
  );
}

Cubic _cubic(List<double> points) =>
    Cubic(points[0], points[1], points[2], points[3]);

/// Durations and easings, from the generated tokens. Widgets ask [duration]
/// so that motion stops when the platform asks for reduced motion.
@immutable
class ShifaMotion {
  /// The motion of the design language; use [standard].
  const new({
    required this.fast,
    required this.base,
    required this.slow,
    required this.standard,
    required this.enter,
    required this.exit,
  });

  /// The motion of both themes.
  static final standardMotion = ShifaMotion(
    fast: ShifaTokens.motionDurationFast,
    base: ShifaTokens.motionDurationBase,
    slow: ShifaTokens.motionDurationSlow,
    standard: _cubic(ShifaTokens.motionEasingStandard),
    enter: _cubic(ShifaTokens.motionEasingEnter),
    exit: _cubic(ShifaTokens.motionEasingExit),
  );

  /// 150 ms: press and hover.
  final Duration fast;

  /// 200 ms: snackbars.
  final Duration base;

  /// 240 ms: sheets.
  final Duration slow;

  /// The easing of a change in place.
  final Cubic standard;

  /// The easing of something arriving.
  final Cubic enter;

  /// The easing of something leaving.
  final Cubic exit;

  /// [value], or no time at all when the platform asks for reduced motion.
  static Duration duration(BuildContext context, Duration value) =>
      MediaQuery.maybeDisableAnimationsOf(context) ?? false
      ? Duration.zero
      : value;

  List<double> _points(Cubic c) => [c.a, c.b, c.c, c.d];

  List<Object> get _values => [
    fast,
    base,
    slow,
    ..._points(standard),
    ..._points(enter),
    ..._points(exit),
  ];

  /// Durations and easings do not blend: the nearer side wins.
  ShifaMotion lerp(ShifaMotion other, double t) => t < 0.5 ? this : other;

  @override
  bool operator ==(Object other) =>
      other is ShifaMotion && listEquals(_values, other._values);

  @override
  int get hashCode => Object.hashAll(_values);
}
