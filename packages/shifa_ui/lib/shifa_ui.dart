/// Shifa's Flutter design system.
///
/// Today it holds the design tokens generated from `packages/tokens`: colours
/// of the light and the dark theme, sizes of both densities and the shared
/// scales. Theme extensions and widgets arrive in slice 0.4-08.
library;

// The generated constants are `Color` values; exporting the type lets a
// consumer use them without importing dart:ui itself.
export 'dart:ui' show Color;

export 'src/generated/tokens.g.dart';
