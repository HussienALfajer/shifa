import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';

/// A white surface on the cream screen: a light border and one small soft
/// shadow (the web Card). With [onPressed] the whole card is one button that
/// opens its record, named by its content.
class ShifaCard extends StatelessWidget {
  /// A card holding [child].
  const new({required this.child, this.onPressed, super.key});

  /// The content.
  final Widget child;

  /// Opens the record; null makes a plain card.
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final onPressed = this.onPressed;
    if (onPressed == null) {
      return _face(context, pressed: false, focused: false);
    }
    return ShifaPressable(
      onPressed: onPressed,
      builder: (context, state) =>
          _face(context, pressed: state.pressed, focused: state.focused),
    );
  }

  Widget _face(
    BuildContext context, {
    required bool pressed,
    required bool focused,
  }) {
    final shifa = context.shifa;
    final colors = shifa.colors;
    final shapes = shifa.shapes;
    final border = focused
        ? Border.all(color: colors.borderFocus, width: shapes.borderFocus)
        : Border.all(color: colors.cardBorder, width: shapes.borderDefault);
    final inset = shifa.spacing.space5 - border.top.width;
    return AnimatedContainer(
      duration: ShifaMotion.duration(context, shifa.motion.fast),
      curve: shifa.motion.standard,
      width: double.infinity,
      padding: EdgeInsetsDirectional.all(inset),
      decoration: BoxDecoration(
        color: pressed ? colors.selectionSubtle : colors.cardBg,
        borderRadius: BorderRadius.circular(shapes.radiusSurface),
        border: border,
        boxShadow: focused
            ? [...shapes.shadowCard, ...shapes.shadowFocus]
            : shapes.shadowCard,
      ),
      child: child,
    );
  }
}
