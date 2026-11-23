import 'package:flutter/widgets.dart';

import 'package:shifa_ui/src/generated/glyphs.g.dart';

/// Draws one glyph on a 24 × 24 grid with 1.5-wide round-capped strokes:
/// [miter] joins by default, [round] joins where the source sets them.
typedef ShifaGlyphPainter = void Function(
  Canvas canvas,
  Paint miter,
  Paint round,
);

/// How a glyph is drawn on a 24 × 24 grid (Solar's, Broken style, OD-65).
@immutable
class ShifaGlyphData {
  /// A glyph drawn by [paint]; [directional] glyphs mirror in right-to-left.
  const new(this.name, this.paint, {this.directional = false});

  /// The glyph's name (for tests and debugging).
  final String name;

  /// Draws it.
  final ShifaGlyphPainter paint;

  /// Whether it points along the reading direction (arrows, chevrons).
  final bool directional;
}

/// The curated glyphs of the base widgets: Solar icons by 480 Design (CC BY
/// 4.0), Broken style, generated into `glyphs.g.dart` by
/// `packages/ui/scripts/icons-sync.ts` (licence: `packages/ui/src/icons/solar/LICENSE.md`).
abstract final class ShifaGlyphs {
  /// A tick.
  static const check = ShifaGlyphData('check', paintCheck);

  /// A cross: close.
  static const close = ShifaGlyphData('close', paintClose);

  /// Points toward the logical end: the next screen (left in Arabic).
  static const chevronForward = ShifaGlyphData(
    'chevronForward',
    paintChevronForward,
    directional: true,
  );

  /// Points toward the logical start: back (right in Arabic).
  static const arrowBack = ShifaGlyphData(
    'arrowBack',
    paintArrowBack,
    directional: true,
  );

  /// A calendar page.
  static const calendar = ShifaGlyphData('calendar', paintCalendar);

  /// A bell: notifications and reminders.
  static const bell = ShifaGlyphData('bell', paintBell);

  /// Three dots: more actions.
  static const more = ShifaGlyphData('more', paintMore);

  /// A ring with a mark: an error.
  static const error = ShifaGlyphData('error', paintError);

  /// A ring with a tick: done.
  static const success = ShifaGlyphData('success', paintSuccess);
}

/// One glyph, sized and coloured by the ambient [IconTheme] unless [size] or
/// [color] say otherwise. Decorative unless [semanticLabel] names it.
class ShifaGlyph extends StatelessWidget {
  /// Draws [data].
  const new(this.data, {this.size, this.color, this.semanticLabel, super.key});

  /// What to draw.
  final ShifaGlyphData data;

  /// The side of the square; the icon theme's size by default.
  final double? size;

  /// The stroke; the icon theme's colour by default.
  final Color? color;

  /// What a screen reader says; none for a decorative glyph.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final theme = IconTheme.of(context);
    final side = size ?? theme.size ?? 24;
    final mirror =
        data.directional && Directionality.of(context) == TextDirection.rtl;
    Widget glyph = CustomPaint(
      size: Size.square(side),
      painter: _GlyphPainter(data, color ?? theme.color!),
    );
    if (mirror) glyph = Transform.flip(flipX: true, child: glyph);
    final label = semanticLabel;
    if (label == null) return ExcludeSemantics(child: glyph);
    return Semantics(
      label: label,
      image: true,
      excludeSemantics: true,
      child: glyph,
    );
  }
}

class _GlyphPainter extends CustomPainter {
  const new(this.data, this.color);

  final ShifaGlyphData data;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    canvas
      ..save()
      ..scale(size.width / 24);
    final miter = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final round = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    data.paint(canvas, miter, round);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlyphPainter old) =>
      old.data != data || old.color != color;
}
