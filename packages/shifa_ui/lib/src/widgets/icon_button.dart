import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';

/// A 48 × 48 button with one glyph (app bar actions, close buttons); its
/// [label] is what a screen reader says. Disabled when [onPressed] is null.
class ShifaIconButton extends StatelessWidget {
  /// A button drawing [glyph], named [label].
  const new({
    required this.glyph,
    required this.label,
    required this.onPressed,
    super.key,
  });

  /// What it draws (directional glyphs mirror in Arabic).
  final ShifaGlyphData glyph;

  /// Its name: «رجوع», «إغلاق».
  final String label;

  /// The action; null disables it.
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final side = shifa.spacing.touchTarget;
    return ShifaPressable(
      onPressed: onPressed,
      semanticLabel: label,
      builder: (context, state) => AnimatedContainer(
        duration: ShifaMotion.duration(context, shifa.motion.fast),
        width: side,
        height: side,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: state.pressed
              ? c.selectionDefault
              : c.bgSurface.withValues(alpha: 0),
          borderRadius: BorderRadius.circular(shifa.shapes.radiusControl),
          border: state.focused
              ? Border.all(
                  color: c.borderFocus,
                  width: shifa.shapes.borderFocus,
                )
              : null,
        ),
        child: ShifaGlyph(
          glyph,
          size: shifa.spacing.space6,
          color: state.enabled ? c.iconDefault : c.textDisabled,
        ),
      ),
    );
  }
}
