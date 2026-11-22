// One golden image per widget and state group: every state in Arabic RTL,
// light beside dark.
import 'dart:async';

import 'package:alchemist/alchemist.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

/// The width of a widget on the 390 px phone (16 px margins).
const phoneContent = 358.0;

/// Both themes, light first.
final bothThemes = [
  ('light', ShifaThemeData.light()),
  ('dark', ShifaThemeData.dark()),
];

/// A golden test of [states] (name → widget) for the widget [fileName],
/// each drawn in every theme of [themes] (light beside dark by default),
/// right to left. [whilePerforming] holds an interaction (a press) while the
/// image is taken; [keyboardFocus] shows focus as a keyboard user sees it.
/// Animations are off, so the frame shows each state's final look.
///
/// Like alchemist's `goldenTest`, it registers a test while `main` runs.
void shifaGoldenTest(
  String description, {
  required String fileName,
  required Map<String, Widget> states,
  double width = phoneContent,
  double? height,
  Interaction? whilePerforming,
  bool keyboardFocus = false,
  List<(String, ShifaThemeData)>? themes,
}) => unawaited(
  goldenTest(
    description,
    fileName: fileName,
    // A spinner would turn for ever: a few frames, not "until it settles".
    pumpBeforeTest: pumpNTimes(3),
    whilePerforming: whilePerforming,
    builder: () {
      if (keyboardFocus) {
        FocusManager.instance.highlightStrategy =
            FocusHighlightStrategy.alwaysTraditional;
        addTearDown(
          () => FocusManager.instance.highlightStrategy =
              FocusHighlightStrategy.automatic,
        );
      }
      final shown = themes ?? bothThemes;
      return GoldenTestGroup(
        columns: shown.length,
        children: [
          for (final MapEntry(key: name, value: widget) in states.entries)
            for (final (themeName, theme) in shown)
              GoldenTestScenario(
                name: '$name · $themeName',
                child: _onPhone(theme, width, height, widget),
              ),
        ],
      );
    },
  ),
);

/// Holds a finger on every widget [finder] finds while the image is taken.
Interaction pressAll(Finder finder) => press(finder);

Widget _onPhone(
  ShifaThemeData theme,
  double width,
  double? height,
  Widget child,
) => Builder(
  builder: (context) => MediaQuery(
    data: MediaQuery.of(context).copyWith(disableAnimations: true),
    child: Localizations(
      locale: const Locale('ar'),
      delegates: const [GlobalWidgetsLocalizations.delegate],
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: ShifaTheme(
          data: theme,
          child: ColoredBox(
            color: theme.colors.bgApp,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(width: width, height: height, child: child),
            ),
          ),
        ),
      ),
    ),
  ),
);
