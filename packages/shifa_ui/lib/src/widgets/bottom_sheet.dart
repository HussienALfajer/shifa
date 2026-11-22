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

  void _close() {
    if (isActive) navigator?.pop();
  }

  void _drag(DragUpdateDetails details) {
    final height = _sheetKey.currentContext?.size?.height ?? 1;
    controller?.value -= details.primaryDelta! / height;
  }

  void _release(DragEndDetails details) {
    final controller = this.controller;
    if (controller == null) return;
    final flung = details.primaryVelocity! > 700;
    if (flung || controller.value < 0.6) {
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
      child: GestureDetector(
        onVerticalDragUpdate: _drag,
        onVerticalDragEnd: _release,
        child: KeyedSubtree(key: _sheetKey, child: sheet(context, _close)),
      ),
    ),
  );

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) => SlideTransition(
    position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
      CurvedAnimation(
        parent: animation,
        curve: theme.motion.enter,
        reverseCurve: theme.motion.exit,
      ),
    ),
    child: child,
  );
}
