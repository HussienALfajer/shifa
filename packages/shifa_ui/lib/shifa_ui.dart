/// Shifa's Flutter design system for the patient app.
///
/// The design tokens generated from `packages/tokens`, the light and dark
/// `ShifaTheme` built from them, and Shifa's base widgets. Built on Flutter's
/// widgets layer, not on Material.
library;

// The generated constants are `Color` values; exporting the type lets a
// consumer use them without importing dart:ui itself.
export 'dart:ui' show Color;

export 'src/generated/tokens.g.dart';
export 'src/licences.dart';
export 'src/theme/colors.dart';
export 'src/theme/metrics.dart';
export 'src/theme/status_colors.dart';
export 'src/theme/theme.dart';
export 'src/theme/typography.dart';
export 'src/widgets/app_bar.dart';
export 'src/widgets/bottom_sheet.dart';
export 'src/widgets/button.dart';
export 'src/widgets/card.dart';
export 'src/widgets/chip.dart';
export 'src/widgets/glyph.dart';
export 'src/widgets/icon_button.dart';
export 'src/widgets/list_item.dart';
export 'src/widgets/snackbar.dart';
export 'src/widgets/spinner.dart';
export 'src/widgets/text_field.dart';
