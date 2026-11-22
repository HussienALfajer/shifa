import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';

/// A filter that is on or off: drawn 36 tall, pressed anywhere in its 48 dp
/// row. Selected chips carry a tick at the logical start, so the state is
/// never colour alone. Disabled when [onSelected] is null.
class ShifaChip extends StatelessWidget {
  /// A chip that says [label].
  const new({
    required this.label,
    required this.selected,
    required this.onSelected,
    super.key,
  });

  /// The key of the drawn face (tests measure it).
  static const Key faceKey = ValueKey('ShifaChip.face');

  /// One or two words: «القادمة».
  final String label;

  /// On or off.
  final bool selected;

  /// Called with the new state; null disables the chip.
  final ValueChanged<bool>? onSelected;

  @override
  Widget build(BuildContext context) {
    final onSelected = this.onSelected;
    final shifa = context.shifa;
    return ShifaPressable(
      onPressed: onSelected == null ? null : () => onSelected(!selected),
      selected: selected,
      builder: (context, state) {
        final c = shifa.colors;
        final shapes = shifa.shapes;
        final spacing = shifa.spacing;
        final (bg, fg, line) = !state.enabled
            ? (c.bgSurfaceRaised, c.textDisabled, c.borderDefault)
            : selected
            ? (
                state.pressed ? c.selectionStrong : c.selectionDefault,
                c.textDefault,
                c.brandPrimary,
              )
            : (
                state.pressed ? c.selectionSubtle : c.bgSurface,
                c.textDefault,
                c.borderStrong,
              );
        final border = state.focused
            ? Border.all(color: c.borderFocus, width: shapes.borderFocus)
            : Border.all(color: line, width: shapes.borderDefault);
        return ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: spacing.touchTarget,
            minWidth: spacing.touchTarget,
          ),
          child: Align(
            widthFactor: 1,
            child: AnimatedContainer(
              key: faceKey,
              duration: ShifaMotion.duration(context, shifa.motion.fast),
              curve: shifa.motion.standard,
              constraints: BoxConstraints(
                minHeight: spacing.space8 + spacing.space1,
              ),
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: spacing.space3 - border.top.width,
                vertical: spacing.space05,
              ),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(shapes.radiusInput),
                border: border,
                boxShadow: state.focused ? shapes.shadowFocus : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (selected) ...[
                    ShifaGlyph(
                      ShifaGlyphs.check,
                      size: spacing.space4,
                      color: fg,
                    ),
                    SizedBox(width: spacing.space1),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      style: shifa.typography.labelSm.copyWith(color: fg),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
