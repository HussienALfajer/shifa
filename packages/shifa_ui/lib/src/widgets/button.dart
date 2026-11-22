import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';
import 'package:shifa_ui/src/widgets/spinner.dart';

/// The four looks of a button (as on the web Button).
enum ShifaButtonVariant {
  /// The one main action of a screen.
  primary,

  /// Every other action (the default).
  secondary,

  /// A light action inside a card or a list.
  ghost,

  /// An action that deletes or cancels (brick, never red).
  danger,
}

/// A button of the approved sheet (0.4-08): 48 dp at least, the label kept
/// while loading, an optional icon at the logical start. Disabled when
/// [onPressed] is null.
class ShifaButton extends StatelessWidget {
  /// A button that says [label].
  const new({
    required this.label,
    required this.onPressed,
    this.variant = ShifaButtonVariant.secondary,
    this.icon,
    this.loading = false,
    this.expand = false,
    this.busyLabel = 'جارٍ التحميل',
    this.focusNode,
    this.autofocus = false,
    super.key,
  });

  /// One verb: «احجز», «ادفع».
  final String label;

  /// The action; null disables the button.
  final VoidCallback? onPressed;

  /// Its look.
  final ShifaButtonVariant variant;

  /// A glyph at the logical start (a `ShifaGlyph`).
  final Widget? icon;

  /// Busy: the spinner takes the icon's place, presses are ignored, focus
  /// and the label stay.
  final bool loading;

  /// Take the full width (a phone's main action).
  final bool expand;

  /// What a screen reader hears while [loading].
  final String busyLabel;

  /// Focus, for callers that move it.
  final FocusNode? focusNode;

  /// Take focus when first shown.
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    return ShifaPressable(
      onPressed: loading ? null : onPressed,
      keepFocus: loading && onPressed != null,
      focusNode: focusNode,
      autofocus: autofocus,
      semanticHint: loading ? busyLabel : null,
      builder: (context, state) {
        final look = _look(shifa, state.pressed, disabled: onPressed == null);
        final colors = shifa.colors;
        final shapes = shifa.shapes;
        final spacing = shifa.spacing;
        final border = state.focused
            ? Border.all(color: colors.borderFocus, width: shapes.borderFocus)
            : Border.all(color: look.border, width: shapes.borderDefault);
        final mark = loading
            ? ShifaSpinner(color: look.fg, size: shifa.spacing.space5)
            : icon;
        final content = Row(
          mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (mark != null) ...[
              IconTheme(
                data: IconThemeData(color: look.fg, size: spacing.space5),
                child: mark,
              ),
              SizedBox(width: spacing.gapInline),
            ],
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: shifa.typography.labelMd.copyWith(color: look.fg),
              ),
            ),
          ],
        );
        return ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: spacing.touchTarget,
            minWidth: expand ? double.infinity : spacing.touchTarget,
          ),
          child: AnimatedContainer(
            duration: ShifaMotion.duration(context, shifa.motion.fast),
            curve: shifa.motion.standard,
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: spacing.space4 - border.top.width,
              vertical: spacing.space2,
            ),
            decoration: BoxDecoration(
              color: look.bg,
              borderRadius: BorderRadius.circular(shapes.radiusControl),
              border: border,
              boxShadow: state.focused ? shapes.shadowFocus : null,
            ),
            alignment: Alignment.center,
            child: content,
          ),
        );
      },
    );
  }

  ({Color bg, Color fg, Color border}) _look(
    ShifaThemeData shifa,
    bool pressed, {
    required bool disabled,
  }) {
    final c = shifa.colors;
    // No fill: the screen colour at zero opacity, so a press fades from it
    // and not from black.
    final clear = c.bgApp.withValues(alpha: 0);
    if (disabled) {
      return variant == ShifaButtonVariant.ghost
          ? (bg: clear, fg: c.textDisabled, border: clear)
          : (
              bg: c.bgSurfaceRaised,
              fg: c.textDisabled,
              border: c.borderDefault,
            );
    }
    final danger = shifa.status.danger;
    return switch (variant) {
      ShifaButtonVariant.primary => (
        bg: pressed ? c.buttonPrimaryBgPressed : c.buttonPrimaryBg,
        fg: c.buttonPrimaryFg,
        border: pressed ? c.buttonPrimaryBgPressed : c.buttonPrimaryBg,
      ),
      ShifaButtonVariant.secondary => (
        bg: pressed ? c.selectionDefault : c.bgSurface,
        fg: c.textDefault,
        border: c.borderStrong,
      ),
      ShifaButtonVariant.ghost => (
        bg: pressed ? c.selectionDefault : clear,
        fg: c.brandPrimary,
        border: pressed ? c.selectionDefault : clear,
      ),
      ShifaButtonVariant.danger => (
        bg: pressed ? danger.fg : danger.solid,
        fg: danger.onSolid,
        border: pressed ? danger.fg : danger.solid,
      ),
    };
  }
}
