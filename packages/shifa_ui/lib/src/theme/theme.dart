import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/colors.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/status_colors.dart';
import 'package:shifa_ui/src/theme/typography.dart';

/// Everything a Shifa widget draws with: one theme of the design language.
///
/// Built on Flutter's widgets layer, not on Material's `ThemeData` (Material
/// left the SDK in Flutter 3.47; slice 0.4-08).
@immutable
class ShifaThemeData {
  /// A theme from its parts; use [ShifaThemeData.light] or
  /// [ShifaThemeData.dark].
  const new({
    required this.brightness,
    required this.colors,
    required this.status,
    required this.typography,
    required this.spacing,
    required this.shapes,
    required this.motion,
  });

  /// The light theme.
  factory light() => _light;

  /// The dark theme.
  factory dark() => _dark;

  static final _light = ShifaThemeData(
    brightness: Brightness.light,
    colors: ShifaColors.light,
    status: ShifaStatusColors.light,
    typography: ShifaTypography.standard,
    spacing: const ShifaSpacing(),
    shapes: ShifaShapes.standard,
    motion: ShifaMotion.standardMotion,
  );

  static final _dark = ShifaThemeData(
    brightness: Brightness.dark,
    colors: ShifaColors.dark,
    status: ShifaStatusColors.dark,
    typography: ShifaTypography.standard,
    spacing: const ShifaSpacing(),
    shapes: ShifaShapes.standard,
    motion: ShifaMotion.standardMotion,
  );

  /// Light or dark.
  final Brightness brightness;

  /// Semantic, brand and component colours (the clinic palette replaces the
  /// brand ones).
  final ShifaColors colors;

  /// The locked colours: status, clinical alerts and the visit queue.
  final ShifaStatusColors status;

  /// The named text styles.
  final ShifaTypography typography;

  /// The spacing scale and touch sizes.
  final ShifaSpacing spacing;

  /// Radii, borders and shadows.
  final ShifaShapes shapes;

  /// Durations and easings.
  final ShifaMotion motion;

  /// The theme a fraction [t] of the way to [other] (a theme switch).
  ShifaThemeData lerp(ShifaThemeData other, double t) => ShifaThemeData(
    brightness: t < 0.5 ? brightness : other.brightness,
    colors: colors.lerp(other.colors, t),
    status: status.lerp(other.status, t),
    typography: typography.lerp(other.typography, t),
    spacing: spacing.lerp(other.spacing, t),
    shapes: shapes.lerp(other.shapes, t),
    motion: motion.lerp(other.motion, t),
  );

  @override
  bool operator ==(Object other) =>
      other is ShifaThemeData &&
      other.brightness == brightness &&
      other.colors == colors &&
      other.status == status &&
      other.typography == typography &&
      other.spacing == spacing &&
      other.shapes == shapes &&
      other.motion == motion;

  @override
  int get hashCode => Object.hash(
    brightness,
    colors,
    status,
    typography,
    spacing,
    shapes,
    motion,
  );
}

/// Gives [data] to every Shifa widget below it, with the body text style and
/// icon colour of the theme as defaults.
class ShifaTheme extends StatelessWidget {
  /// Puts [data] above [child].
  const new({required this.data, required this.child, super.key});

  /// The theme.
  final ShifaThemeData data;

  /// The subtree that uses it.
  final Widget child;

  /// The nearest theme; throws a [FlutterError] naming [ShifaTheme] when
  /// there is none.
  static ShifaThemeData of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_ShifaScope>();
    if (scope == null) {
      throw FlutterError.fromParts([
        ErrorSummary('No ShifaTheme above this widget.'),
        ErrorHint(
          'Wrap the app in ShifaTheme(data: ShifaThemeData.light(), child: …).',
        ),
      ]);
    }
    return scope.data;
  }

  @override
  Widget build(BuildContext context) => _ShifaScope(
    data: data,
    child: DefaultTextStyle(
      style: data.typography.paragraphMd.copyWith(
        color: data.colors.textDefault,
      ),
      child: IconTheme(
        data: IconThemeData(
          color: data.colors.iconDefault,
          size: data.spacing.space6,
        ),
        child: child,
      ),
    ),
  );
}

class _ShifaScope extends InheritedWidget {
  const new({required this.data, required super.child});

  final ShifaThemeData data;

  @override
  bool updateShouldNotify(_ShifaScope oldWidget) => data != oldWidget.data;
}

/// `context.shifa`: the nearest [ShifaThemeData].
extension ShifaContext on BuildContext {
  /// The nearest theme (see [ShifaTheme.of]).
  ShifaThemeData get shifa => ShifaTheme.of(this);
}
