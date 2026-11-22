import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

/// What a pressable surface looks like right now.
typedef ShifaPressState = ({bool pressed, bool focused, bool enabled});

/// The press behaviour every Shifa control shares: one button in the
/// semantics tree (its label merged from its content), a press on tap or on
/// Enter and Space, a pressed look while a finger is down, and a focus look
/// for keyboard and switch users. Not exported: the widgets wrap it.
class ShifaPressable extends StatefulWidget {
  /// A pressable area drawn by [builder].
  const new({
    required this.builder,
    required this.onPressed,
    this.keepFocus = false,
    this.focusNode,
    this.autofocus = false,
    this.selected,
    this.semanticHint,
    super.key,
  });

  /// Draws the area for its state.
  final Widget Function(BuildContext context, ShifaPressState state) builder;

  /// Called on a press; null makes the area disabled.
  final VoidCallback? onPressed;

  /// Stay focusable while [onPressed] is null (a busy button keeps focus).
  final bool keepFocus;

  /// Focus, for callers that move it.
  final FocusNode? focusNode;

  /// Take focus when first shown.
  final bool autofocus;

  /// Selected state for toggles (chips); null when it is not one.
  final bool? selected;

  /// Extra words for screen readers ("جارٍ التحميل").
  final String? semanticHint;

  @override
  State<ShifaPressable> createState() => _ShifaPressableState();
}

const _activate = <ShortcutActivator, Intent>{
  SingleActivator(LogicalKeyboardKey.enter): ActivateIntent(),
  SingleActivator(LogicalKeyboardKey.numpadEnter): ActivateIntent(),
  SingleActivator(LogicalKeyboardKey.space): ActivateIntent(),
};

class _ShifaPressableState extends State<ShifaPressable> {
  bool _pressed = false;
  bool _focused = false;

  void _press(bool down) {
    if (_pressed != down) setState(() => _pressed = down);
  }

  @override
  void didUpdateWidget(ShifaPressable oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.onPressed == null) _pressed = false;
  }

  @override
  Widget build(BuildContext context) {
    final onPressed = widget.onPressed;
    final enabled = onPressed != null;
    final busy = widget.keepFocus && !enabled;
    return MergeSemantics(
      child: Semantics(
        button: true,
        enabled: enabled || busy,
        selected: widget.selected,
        hint: widget.semanticHint,
        onTap: onPressed,
        child: FocusableActionDetector(
          enabled: enabled || busy,
          focusNode: widget.focusNode,
          autofocus: widget.autofocus,
          shortcuts: _activate,
          actions: {
            ActivateIntent: CallbackAction<ActivateIntent>(
              onInvoke: (_) {
                onPressed?.call();
                return null;
              },
            ),
          },
          onShowFocusHighlight: (on) => setState(() => _focused = on),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            excludeFromSemantics: true,
            onTapDown: enabled ? (_) => _press(true) : null,
            onTapUp: enabled ? (_) => _press(false) : null,
            onTapCancel: enabled ? () => _press(false) : null,
            onTap: onPressed,
            child: widget.builder(context, (
              pressed: _pressed && enabled,
              focused: _focused,
              enabled: enabled,
            )),
          ),
        ),
      ),
    );
  }
}
