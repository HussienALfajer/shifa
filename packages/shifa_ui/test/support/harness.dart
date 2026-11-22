// Puts a widget on an Arabic, right-to-left phone screen with a Shifa theme:
// the setting of every widget and golden test of shifa_ui.
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

/// The phone the sheet is drawn on.
const phone = Size(390, 844);

/// [child] on an Arabic RTL screen of [size], in [theme] (light by default),
/// with text scaled by [textScale]; [reduceMotion] asks for no animation.
Widget harness(
  Widget child, {
  ShifaThemeData? theme,
  double textScale = 1,
  Size size = phone,
  bool reduceMotion = false,
}) => MediaQuery(
  data: MediaQueryData(
    size: size,
    textScaler: TextScaler.linear(textScale),
    disableAnimations: reduceMotion,
  ),
  child: Localizations(
    locale: const Locale('ar'),
    delegates: const [GlobalWidgetsLocalizations.delegate],
    child: Directionality(
      textDirection: TextDirection.rtl,
      child: ShifaTheme(
        data: theme ?? ShifaThemeData.light(),
        // A new Overlay per harness: its entries are read only once, so a
        // second pump in one test would keep showing the first child.
        child: Overlay(
          key: UniqueKey(),
          initialEntries: [
            OverlayEntry(
              builder: (context) => ColoredBox(
                color: context.shifa.colors.bgApp,
                child: Align(
                  alignment: AlignmentDirectional.topStart,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: child,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  ),
);

/// [child] as a whole phone screen inside a [Navigator] (routes, sheets),
/// Arabic RTL, in [theme] (light by default); [padding] is the system's
/// safe-area insets.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget child, {
  ShifaThemeData? theme,
  bool reduceMotion = false,
  EdgeInsets padding = EdgeInsets.zero,
}) async {
  tester.view.physicalSize = phone;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(
        size: phone,
        padding: padding,
        disableAnimations: reduceMotion,
      ),
      child: Localizations(
        locale: const Locale('ar'),
        delegates: const [GlobalWidgetsLocalizations.delegate],
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: ShifaTheme(
            data: theme ?? ShifaThemeData.light(),
            child: Navigator(
              onGenerateRoute: (settings) => PageRouteBuilder<void>(
                settings: settings,
                pageBuilder: (context, _, _) =>
                    ColoredBox(color: context.shifa.colors.bgApp, child: child),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// Pumps [harness] for a phone-sized surface.
Future<void> pumpPhone(
  WidgetTester tester,
  Widget child, {
  ShifaThemeData? theme,
  double textScale = 1,
  bool reduceMotion = false,
}) async {
  tester.view.physicalSize = phone;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    harness(
      child,
      theme: theme,
      textScale: textScale,
      reduceMotion: reduceMotion,
    ),
  );
}

/// The smallest side of what [finder] finds, in logical pixels.
double shortestSide(WidgetTester tester, Finder finder) =>
    tester.getSize(finder).shortestSide;
