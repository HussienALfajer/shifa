import 'package:flutter/widgets.dart';

/// Draws one glyph on a 24 × 24 grid with a 2-wide round [stroke] or a [fill]
/// of the same colour.
typedef ShifaGlyphPainter = void Function(
  Canvas canvas,
  Paint stroke,
  Paint fill,
);

/// How a glyph is drawn on a 24 × 24 grid (Tabler Icons', outline, OD-65).
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

Path _poly(List<double> xy) {
  final path = Path()..moveTo(xy[0], xy[1]);
  for (var i = 2; i < xy.length; i += 2) {
    path.lineTo(xy[i], xy[i + 1]);
  }
  return path;
}

// Each painter follows the path data of the Tabler glyph named beside it.

// check
void _check(Canvas c, Paint s, Paint f) =>
    c.drawPath(_poly([5, 12, 10, 17, 20, 7]), s);

// x
void _close(Canvas c, Paint s, Paint f) => c
  ..drawLine(const Offset(18, 6), const Offset(6, 18), s)
  ..drawLine(const Offset(6, 6), const Offset(18, 18), s);

// chevron-right
void _chevronForward(Canvas c, Paint s, Paint f) =>
    c.drawPath(_poly([9, 6, 15, 12, 9, 18]), s);

// arrow-left
void _arrowBack(Canvas c, Paint s, Paint f) => c
  ..drawLine(const Offset(5, 12), const Offset(19, 12), s)
  ..drawPath(_poly([11, 18, 5, 12, 11, 6]), s);

// calendar
void _calendar(Canvas c, Paint s, Paint f) => c
  ..drawRRect(RRect.fromLTRBR(4, 5, 20, 21, const Radius.circular(2)), s)
  ..drawLine(const Offset(16, 3), const Offset(16, 7), s)
  ..drawLine(const Offset(8, 3), const Offset(8, 7), s)
  ..drawLine(const Offset(4, 11), const Offset(20, 11), s);

// bell
void _bell(Canvas c, Paint s, Paint f) {
  final body = Path()
    ..moveTo(10, 5)
    ..arcToPoint(
      const Offset(14, 5),
      radius: const Radius.circular(2),
      largeArc: true,
    )
    ..arcToPoint(const Offset(18, 11), radius: const Radius.circular(7))
    ..lineTo(18, 14)
    ..arcToPoint(
      const Offset(20, 17),
      radius: const Radius.circular(4),
      clockwise: false,
    )
    ..lineTo(4, 17)
    ..arcToPoint(
      const Offset(6, 14),
      radius: const Radius.circular(4),
      clockwise: false,
    )
    ..lineTo(6, 11)
    ..arcToPoint(const Offset(10, 5), radius: const Radius.circular(7));
  final clapper = Path()
    ..moveTo(9, 17)
    ..lineTo(9, 18)
    ..arcToPoint(
      const Offset(15, 18),
      radius: const Radius.circular(3),
      clockwise: false,
    )
    ..lineTo(15, 17);
  c
    ..drawPath(body, s)
    ..drawPath(clapper, s);
}

// dots-vertical: three stroked rings of radius 1, which a 2-wide stroke fills.
void _more(Canvas c, Paint s, Paint f) {
  for (final y in [5.0, 12.0, 19.0]) {
    c.drawCircle(Offset(12, y), 1, s);
  }
}

// alert-circle: the dot is a round cap, a disc of radius 1.
void _error(Canvas c, Paint s, Paint f) => c
  ..drawCircle(const Offset(12, 12), 9, s)
  ..drawLine(const Offset(12, 8), const Offset(12, 12), s)
  ..drawCircle(const Offset(12, 16), 1, f);

// circle-check
void _success(Canvas c, Paint s, Paint f) => c
  ..drawCircle(const Offset(12, 12), 9, s)
  ..drawPath(_poly([9, 12, 11, 14, 15, 10]), s);

/// The curated glyphs of the base widgets, drawn after Tabler Icons (MIT).
abstract final class ShifaGlyphs {
  /// A tick.
  static const check = ShifaGlyphData('check', _check);

  /// A cross: close.
  static const close = ShifaGlyphData('close', _close);

  /// Points toward the logical end: the next screen (left in Arabic).
  static const chevronForward = ShifaGlyphData(
    'chevronForward',
    _chevronForward,
    directional: true,
  );

  /// Points toward the logical start: back (right in Arabic).
  static const arrowBack = ShifaGlyphData(
    'arrowBack',
    _arrowBack,
    directional: true,
  );

  /// A calendar page.
  static const calendar = ShifaGlyphData('calendar', _calendar);

  /// A bell: notifications and reminders.
  static const bell = ShifaGlyphData('bell', _bell);

  /// Three dots: more actions.
  static const more = ShifaGlyphData('more', _more);

  /// A ring with a mark: an error.
  static const error = ShifaGlyphData('error', _error);

  /// A ring with a tick: done.
  static const success = ShifaGlyphData('success', _success);
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

  /// The stroke and fill; the icon theme's colour by default.
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
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()..color = color;
    data.paint(canvas, stroke, fill);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlyphPainter old) =>
      old.data != data || old.color != color;
}
