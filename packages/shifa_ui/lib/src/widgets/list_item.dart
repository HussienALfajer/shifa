import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';

/// A row of a list (0.4-08 sheet): a leading picture or glyph at the logical
/// start, a title and an optional second line, and at the end a chevron
/// toward the next screen (or [trailing]). With [onPressed] the row is one
/// button named by its texts; without it, a plain row.
class ShifaListItem extends StatelessWidget {
  /// A row titled [title].
  const new({
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onPressed,
    this.enabled = true,
    this.divided = false,
    super.key,
  });

  /// The main line: a name, a setting.
  final String title;

  /// A second, quieter line: a file number, a date.
  final String? subtitle;

  /// An avatar or a glyph at the logical start.
  final Widget? leading;

  /// What sits at the end in place of the chevron (a status pill, a value).
  final Widget? trailing;

  /// Opens what the row stands for; null makes a plain row.
  final VoidCallback? onPressed;

  /// False: drawn disabled and never pressed.
  final bool enabled;

  /// A line under the row (rows inside one card).
  final bool divided;

  @override
  Widget build(BuildContext context) {
    final onPressed = this.onPressed;
    if (onPressed == null && enabled) {
      return _row(context, pressed: false, focused: false, pressable: false);
    }
    return ShifaPressable(
      onPressed: enabled ? onPressed : null,
      builder: (context, state) => _row(
        context,
        pressed: state.pressed,
        focused: state.focused,
        pressable: true,
      ),
    );
  }

  Widget _row(
    BuildContext context, {
    required bool pressed,
    required bool focused,
    required bool pressable,
  }) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final spacing = shifa.spacing;
    final fg = enabled ? c.textDefault : c.textDisabled;
    final quiet = enabled ? c.textMuted : c.textDisabled;
    final end =
        trailing ??
        (pressable && enabled
            ? ShifaGlyph(ShifaGlyphs.chevronForward, size: spacing.space5)
            : null);
    final line = BorderSide(
      color: c.borderDefault,
      width: shifa.shapes.borderDefault,
    );
    // The height follows the content at once; only the colours animate.
    return ConstrainedBox(
      constraints: BoxConstraints(
        minHeight: subtitle == null
            ? spacing.touchTarget
            : spacing.touchTarget + spacing.space4,
      ),
      child: _animated(context, pressed, focused, line, fg, quiet, end),
    );
  }

  Widget _animated(
    BuildContext context,
    bool pressed,
    bool focused,
    BorderSide line,
    Color fg,
    Color quiet,
    Widget? end,
  ) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final spacing = shifa.spacing;
    final type = shifa.typography;
    final subtitle = this.subtitle;
    final leading = this.leading;
    return AnimatedContainer(
      duration: ShifaMotion.duration(context, shifa.motion.fast),
      curve: shifa.motion.standard,
      padding: EdgeInsetsDirectional.symmetric(
        horizontal: spacing.space4,
        vertical: spacing.space2,
      ),
      decoration: BoxDecoration(
        color: pressed ? c.selectionSubtle : c.bgSurface.withValues(alpha: 0),
        border: focused
            ? Border.all(color: c.borderFocus, width: shifa.shapes.borderFocus)
            : divided
            ? Border(bottom: line)
            : null,
      ),
      child: IconTheme(
        data: IconThemeData(
          color: enabled ? c.iconDefault : c.textDisabled,
          size: spacing.space6,
        ),
        child: Row(
          children: [
            if (leading != null) ...[leading, SizedBox(width: spacing.space3)],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(title, style: type.paragraphMd.copyWith(color: fg)),
                  if (subtitle != null)
                    Text(
                      subtitle,
                      style: type.paragraphData.copyWith(
                        color: quiet,
                        fontSize: type.labelSm.fontSize,
                      ),
                    ),
                ],
              ),
            ),
            if (end != null) ...[
              SizedBox(width: spacing.space3),
              DefaultTextStyle.merge(
                style: type.labelSm.copyWith(color: quiet),
                child: end,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
