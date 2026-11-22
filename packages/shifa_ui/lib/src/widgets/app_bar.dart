import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/theme.dart';
import 'package:shifa_ui/src/widgets/glyph.dart';
import 'package:shifa_ui/src/widgets/icon_button.dart';

/// The bar at the top of a screen (0.4-08 sheet): a back button and the
/// title at the logical start (the right in Arabic), actions at the end.
/// It clears the status bar; the title is one line and a heading.
class ShifaAppBar extends StatelessWidget {
  /// A bar titled [title].
  const new({
    required this.title,
    this.onBack,
    this.backLabel = 'رجوع',
    this.actions = const [],
    super.key,
  });

  /// The screen's name.
  final String title;

  /// Goes back; null shows no back button (a root screen).
  final VoidCallback? onBack;

  /// What a screen reader calls the back button.
  final String backLabel;

  /// Icon buttons at the logical end ([ShifaIconButton]).
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final shifa = context.shifa;
    final c = shifa.colors;
    final spacing = shifa.spacing;
    final onBack = this.onBack;
    final top = MediaQuery.paddingOf(context).top;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: c.bgApp,
        border: Border(
          bottom: BorderSide(
            color: c.borderDefault,
            width: shifa.shapes.borderDefault,
          ),
        ),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          top: top + spacing.space2,
          bottom: spacing.space2,
          start: spacing.space1,
          end: spacing.space1,
        ),
        child: Row(
          children: [
            if (onBack != null)
              ShifaIconButton(
                glyph: ShifaGlyphs.arrowBack,
                label: backLabel,
                onPressed: onBack,
              ),
            Expanded(
              child: Padding(
                padding: EdgeInsetsDirectional.symmetric(
                  horizontal: onBack == null ? spacing.space3 : spacing.space1,
                ),
                child: Semantics(
                  header: true,
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: shifa.typography.titleSm.copyWith(
                      color: c.textDefault,
                    ),
                  ),
                ),
              ),
            ),
            ...actions,
            if (actions.isEmpty) SizedBox(height: spacing.touchTarget),
          ],
        ),
      ),
    );
  }
}
