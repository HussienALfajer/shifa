import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';
import 'package:shifa_ui/src/widgets/icon_button.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';

/// What a message reports; success and error carry their icon, so the tone
/// is never colour alone.
enum ShifaSnackbarTone {
  /// Plain information («أُلغي الموعد»), usually with an action.
  neutral,

  /// Something worked («تم حجز موعدك»).
  success,

  /// Something failed; stays until it is closed.
  error,
}

/// A short message at the bottom of the phone (0.4-08 sheet, the web Toast
/// adapted): a white card, an icon for its tone, one action at the end, and
/// a close button for an error. Shown through [ShifaSnackbar.show].
class ShifaSnackbar extends StatelessWidget {
  /// A message saying [message].
  const new({
    required this.message,
    this.tone = ShifaSnackbarTone.neutral,
    this.actionLabel,
    this.onAction,
    this.onClose,
    this.closeLabel = 'إغلاق',
    super.key,
  });

  /// Shows [message] in the nearest [ShifaSnackbarHost]: one at a time on a
  /// phone (a new one replaces it), gone after [duration] unless it is an
  /// error, which stays until it is closed.
  static void show(
    BuildContext context, {
    required String message,
    ShifaSnackbarTone tone = ShifaSnackbarTone.neutral,
    String? actionLabel,
    VoidCallback? onAction,
    Duration duration = const Duration(seconds: 4),
  }) {
    final host = context.findAncestorStateOfType<_ShifaSnackbarHostState>();
    if (host == null) {
      throw FlutterError.fromParts([
        ErrorSummary('No ShifaSnackbarHost above this widget.'),
        ErrorHint('Put ShifaSnackbarHost around the app’s screens.'),
      ]);
    }
    host._show(
      _Message(
        message: message,
        tone: tone,
        actionLabel: actionLabel,
        onAction: onAction,
      ),
      duration,
    );
  }

  /// The words: one short sentence.
  final String message;

  /// Its tone.
  final ShifaSnackbarTone tone;

  /// One verb at the end: «تراجع».
  final String? actionLabel;

  /// What the action does.
  final VoidCallback? onAction;

  /// Closes it; shown as a close button (errors).
  final VoidCallback? onClose;

  /// The close button's name.
  final String closeLabel;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final spacing = shifa.spacing;
    final onClose = this.onClose;
    final onAction = this.onAction;
    final actionLabel = this.actionLabel;
    final (glyph, color) = switch (tone) {
      ShifaSnackbarTone.neutral => (null, c.iconDefault),
      ShifaSnackbarTone.success => (
        ShifaGlyphs.success,
        shifa.status.success.fg,
      ),
      ShifaSnackbarTone.error => (ShifaGlyphs.error, shifa.status.danger.fg),
    };
    return Semantics(
      container: true,
      liveRegion: true,
      child: Container(
        constraints: BoxConstraints(
          minHeight: spacing.touchTarget + spacing.space2,
        ),
        padding: EdgeInsetsDirectional.only(
          start: spacing.space4,
          end: spacing.space1,
          top: spacing.space1,
          bottom: spacing.space1,
        ),
        decoration: BoxDecoration(
          color: c.bgSurface,
          borderRadius: BorderRadius.circular(shifa.shapes.radiusControl),
          border: Border.all(
            color: c.borderDefault,
            width: shifa.shapes.borderDefault,
          ),
          boxShadow: shifa.shapes.shadowDropdown,
        ),
        child: Row(
          children: [
            if (glyph != null) ...[
              ShifaGlyph(glyph, size: spacing.space5, color: color),
              SizedBox(width: spacing.space3 - spacing.space05),
            ],
            Expanded(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: spacing.space2),
                child: Text(
                  message,
                  style: shifa.typography.paragraphData.copyWith(
                    color: c.textDefault,
                  ),
                ),
              ),
            ),
            if (actionLabel != null && onAction != null)
              _Action(label: actionLabel, onPressed: onAction),
            if (onClose != null)
              ShifaIconButton(
                glyph: ShifaGlyphs.close,
                label: closeLabel,
                onPressed: onClose,
              ),
          ],
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const new({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final c = shifa.colors;
    return ShifaPressable(
      onPressed: onPressed,
      builder: (context, state) => Container(
        constraints: BoxConstraints(
          minHeight: shifa.spacing.touchTarget,
          minWidth: shifa.spacing.touchTarget,
        ),
        padding: EdgeInsetsDirectional.symmetric(
          horizontal: shifa.spacing.space3,
        ),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: state.pressed ? c.selectionDefault : c.bgSurface,
          borderRadius: BorderRadius.circular(shifa.shapes.radiusControl),
          border: state.focused
              ? Border.all(
                  color: c.borderFocus,
                  width: shifa.shapes.borderFocus,
                )
              : null,
        ),
        child: Text(
          label,
          style: shifa.typography.labelMd.copyWith(
            color: c.brandPrimary,
            fontSize: shifa.typography.paragraphData.fontSize,
          ),
        ),
      ),
    );
  }
}

class _Message {
  const new({
    required this.message,
    required this.tone,
    required this.actionLabel,
    required this.onAction,
  });

  final String message;
  final ShifaSnackbarTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
}

/// Holds the snackbar of the screens below it, 16 from the sides and the
/// bottom (above the system's bottom inset). Put it once around the app's
/// screens.
class ShifaSnackbarHost extends StatefulWidget {
  /// A host over [child].
  const new({required this.child, super.key});

  /// The screens.
  final Widget child;

  @override
  State<ShifaSnackbarHost> createState() => _ShifaSnackbarHostState();
}

class _ShifaSnackbarHostState extends State<ShifaSnackbarHost> {
  _Message? _current;
  int _shown = 0;
  Timer? _timer;

  void _show(_Message message, Duration duration) {
    _timer?.cancel();
    setState(() {
      _current = message;
      _shown++;
    });
    // An error stays; so does a message with an action while a screen reader
    // is on, so its user can reach «تراجع» (WCAG 2.2.1).
    final waitsForReader =
        message.actionLabel != null &&
        MediaQuery.maybeAccessibleNavigationOf(context) == true;
    if (message.tone != ShifaSnackbarTone.error && !waitsForReader) {
      _timer = Timer(duration, _hide);
    }
  }

  void _hide() {
    _timer?.cancel();
    if (mounted) setState(() => _current = null);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final spacing = shifa.spacing;
    final current = _current;
    final onAction = current?.onAction;
    final duration = ShifaMotion.duration(context, shifa.motion.base);
    return Stack(
      children: [
        Positioned.fill(child: widget.child),
        Positioned(
          left: spacing.space4,
          right: spacing.space4,
          bottom: MediaQuery.paddingOf(context).bottom + spacing.space4,
          child: AnimatedSwitcher(
            duration: duration,
            switchInCurve: shifa.motion.enter,
            switchOutCurve: shifa.motion.exit,
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween(
                  begin: const Offset(0, 0.15),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            ),
            child: current == null
                ? const SizedBox.shrink()
                : ShifaSnackbar(
                    key: ValueKey(_shown),
                    message: current.message,
                    tone: current.tone,
                    actionLabel: current.actionLabel,
                    onAction: onAction == null
                        ? null
                        : () {
                            // Hide first: the action may show a follow-up.
                            _hide();
                            onAction();
                          },
                    onClose: current.tone == ShifaSnackbarTone.error
                        ? _hide
                        : null,
                  ),
          ),
        ),
      ],
    );
  }
}
