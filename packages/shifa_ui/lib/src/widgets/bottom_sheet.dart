import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';
import 'package:shifa_ui/src/widgets/icon_button.dart';
import 'package:shifa_ui/src/widgets/pressable.dart';

/// Opens a [ShifaBottomSheet] over a scrim and returns what it is popped
/// with (null when it is closed). It rises in 240 ms (at once under reduced
/// motion); the close button, the grabber, a press on the scrim and a drag
/// down close it.
Future<T?> showShifaBottomSheet<T>(
  BuildContext context, {
  required String title,
  required WidgetBuilder builder,
  String? subtitle,
  List<Widget> actions = const [],
  String closeLabel = 'إغلاق',
  String grabberLabel = 'اسحب للإغلاق',
  String scrimLabel = 'إغلاق اللوحة',
}) {
  final theme = context.shifa;
  return Navigator.of(context).push(
    _SheetRoute<T>(
      theme: theme,
      duration: ShifaMotion.duration(context, theme.motion.slow),
      scrimLabel: scrimLabel,
      sheet: (context, close) => ShifaBottomSheet(
        title: title,
        subtitle: subtitle,
        actions: actions,
        closeLabel: closeLabel,
        grabberLabel: grabberLabel,
        onClose: close,
        child: Builder(builder: builder),
      ),
    ),
  );
}

/// The sheet itself (0.4-08 sheet): a surface with rounded top corners, a
/// named grabber, a title with a close button, content that scrolls inside,
/// and actions at the foot. At most 5/6 of the screen. [showShifaBottomSheet]
/// shows it as a route; on its own it is drawn in place (goldens).
class ShifaBottomSheet extends StatelessWidget {
  /// A sheet titled [title] holding [child].
  const new({
    required this.title,
    required this.child,
    required this.onClose,
    this.subtitle,
    this.actions = const [],
    this.closeLabel = 'إغلاق',
    this.grabberLabel = 'اسحب للإغلاق',
    super.key,
  });

  /// What the sheet is about: «موعد ريم العلي».
  final String title;

  /// A quieter line under the title.
  final String? subtitle;

  /// The content; it scrolls when the sheet is full.
  final Widget child;

  /// Buttons at the foot, the main one first.
  final List<Widget> actions;

  /// Closes the sheet (the close button and the grabber).
  final VoidCallback onClose;

  /// The close button's name.
  final String closeLabel;

  /// The grabber's name.
  final String grabberLabel;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final spacing = shifa.spacing;
    final radius = Radius.circular(shifa.shapes.radiusOverlay);
    final line = BorderSide(
      color: c.borderDefault,
      width: shifa.shapes.borderDefault,
    );
    final subtitle = this.subtitle;
    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label: title,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 5 / 6,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: c.bgSurface,
            borderRadius: BorderRadius.only(topLeft: radius, topRight: radius),
            boxShadow: shifa.shapes.shadowModal,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: _Grabber(label: grabberLabel, onPressed: onClose),
              ),
              Padding(
                padding: EdgeInsetsDirectional.only(
                  start: spacing.space5,
                  end: spacing.space2,
                  bottom: spacing.space3,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Semantics(
                            header: true,
                            child: Text(title, style: shifa.typography.titleSm),
                          ),
                          if (subtitle != null)
                            Text(
                              subtitle,
                              style: shifa.typography.paragraphData.copyWith(
                                color: c.textMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                    ShifaIconButton(
                      glyph: ShifaGlyphs.close,
                      label: closeLabel,
                      onPressed: onClose,
                    ),
                  ],
                ),
              ),
              Flexible(
                child: DecoratedBox(
                  decoration: BoxDecoration(border: Border(top: line)),
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(vertical: spacing.space1),
                    child: child,
                  ),
                ),
              ),
              DecoratedBox(
                decoration: BoxDecoration(
                  border: actions.isEmpty ? null : Border(top: line),
                ),
                child: Padding(
                  padding: EdgeInsetsDirectional.only(
                    start: spacing.space4,
                    end: spacing.space4,
                    top: actions.isEmpty ? 0 : spacing.space3,
                    bottom:
                        MediaQuery.paddingOf(context).bottom + spacing.space4,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final (i, action) in actions.indexed) ...[
                        if (i > 0) SizedBox(height: spacing.space2),
                        action,
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Grabber extends StatelessWidget {
  const new({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final spacing = shifa.spacing;
    return ShifaPressable(
      onPressed: onPressed,
      semanticLabel: label,
      builder: (context, state) => SizedBox(
        width: spacing.space12 + spacing.space4,
        height: spacing.touchTarget - spacing.space3,
        child: Center(
          child: Container(
            width: spacing.space8 + spacing.space1,
            height: spacing.space1,
            decoration: BoxDecoration(
              color: state.focused
                  ? shifa.colors.borderFocus
                  : shifa.colors.borderStrong,
              borderRadius: BorderRadius.circular(shifa.shapes.radiusPill),
            ),
          ),
        ),
      ),
    );
  }
}

class _SheetRoute<T> extends PopupRoute<T> {
  new({
    required this.theme,
    required this.duration,
    required this.scrimLabel,
    required this.sheet,
  });

  final ShifaThemeData theme;
  final Duration duration;
  final String scrimLabel;
  final Widget Function(BuildContext context, VoidCallback close) sheet;

  /// The drawn sheet: a drag turns its pixels into the route's 0–1 progress.
  final GlobalKey _sheetKey = GlobalKey();

  @override
  Color get barrierColor => theme.colors.bgOverlay;

  @override
  bool get barrierDismissible => true;

  @override
  String get barrierLabel => scrimLabel;

  @override
  Duration get transitionDuration => duration;

  /// True from the first drag until the sheet has settled: the sheet then
  /// moves with the finger (raw progress), not along the entry curve.
  bool _dragged = false;

  /// Closes this sheet, even when another route was pushed above it.
  void _close() {
    if (isCurrent) {
      navigator?.pop();
    } else if (isActive) {
      navigator?.removeRoute(this);
    }
  }

  void _drag(DragUpdateDetails details) {
    final controller = this.controller;
    if (controller == null) return;
    if (!_dragged) {
      _dragged = true;
      controller.addStatusListener(_settled);
    }
    final height = _sheetKey.currentContext?.size?.height ?? 1;
    controller.value -= details.primaryDelta! / height;
  }

  void _settled(AnimationStatus status) {
    // Settled open or closed: the next open uses the entry curve again.
    if (!status.isAnimating) {
      _dragged = false;
      controller?.removeStatusListener(_settled);
    }
  }

  void _release(DragEndDetails details) {
    final controller = this.controller;
    if (controller == null) return;
    final velocity = details.primaryVelocity ?? 0;
    final close =
        velocity > 700 || (velocity >= -700 && controller.value < 0.6);
    if (close) {
      _close();
    } else {
      controller.forward();
    }
  }

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) => ShifaTheme(
    data: theme,
    child: Align(
      alignment: Alignment.bottomCenter,
      // The sheet slides by its own height, so a drag of n pixels moves it
      // n pixels.
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, child) {
          final t = animation.value;
          final shown = _dragged
              ? t
              : animation.status == AnimationStatus.reverse
              ? theme.motion.exit.transform(t)
              : theme.motion.enter.transform(t);
          return FractionalTranslation(
            translation: Offset(0, 1 - shown),
            child: child,
          );
        },
        child: GestureDetector(
          onVerticalDragUpdate: _drag,
          onVerticalDragEnd: _release,
          child: KeyedSubtree(key: _sheetKey, child: sheet(context, _close)),
        ),
      ),
    ),
  );
}
