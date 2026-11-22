import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Draws one glyph on a 256 × 256 grid with a 16-wide round [stroke] or a
/// [fill] of the same colour.
typedef ShifaGlyphPainter = void Function(
  Canvas canvas,
  Paint stroke,
  Paint fill,
);

/// How a glyph is drawn on a 256 × 256 grid (Phosphor's).
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

void _check(Canvas c, Paint s, Paint f) =>
    c.drawPath(_poly([40, 144, 96, 200, 224, 72]), s);

void _close(Canvas c, Paint s, Paint f) => c
  ..drawLine(const Offset(200, 56), const Offset(56, 200), s)
  ..drawLine(const Offset(200, 200), const Offset(56, 56), s);

void _chevronForward(Canvas c, Paint s, Paint f) =>
    c.drawPath(_poly([96, 48, 176, 128, 96, 208]), s);

void _arrowBack(Canvas c, Paint s, Paint f) => c
  ..drawLine(const Offset(216, 128), const Offset(40, 128), s)
  ..drawPath(_poly([112, 56, 40, 128, 112, 200]), s);

void _calendar(Canvas c, Paint s, Paint f) => c
  ..drawRRect(RRect.fromLTRBR(40, 40, 216, 216, const Radius.circular(8)), s)
  ..drawLine(const Offset(176, 24), const Offset(176, 56), s)
  ..drawLine(const Offset(80, 24), const Offset(80, 56), s)
  ..drawLine(const Offset(40, 88), const Offset(216, 88), s);

void _bell(Canvas c, Paint s, Paint f) {
  final body = Path()
    ..moveTo(56, 104)
    ..arcToPoint(const Offset(200, 104), radius: const Radius.circular(72))
    ..cubicTo(200, 140, 208, 160, 214, 172)
    ..lineTo(42, 172)
    ..cubicTo(48, 160, 56, 140, 56, 104)
    ..close();
  c
    ..drawPath(body, s)
    ..drawArc(
      Rect.fromCircle(center: const Offset(128, 192), radius: 32),
      0,
      math.pi,
      false,
      s,
    );
}

void _more(Canvas c, Paint s, Paint f) {
  for (final y in [60.0, 128.0, 196.0]) {
    c.drawCircle(Offset(128, y), 14, f);
  }
}

void _error(Canvas c, Paint s, Paint f) => c
  ..drawCircle(const Offset(128, 128), 96, s)
  ..drawLine(const Offset(128, 80), const Offset(128, 136), s)
  ..drawCircle(const Offset(128, 172), 12, f);

void _success(Canvas c, Paint s, Paint f) => c
  ..drawCircle(const Offset(128, 128), 96, s)
  ..drawPath(_poly([88, 132, 116, 160, 172, 104]), s);

/// The curated glyphs of the base widgets, drawn after Phosphor (MIT).
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
      ..scale(size.width / 256);
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 16
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
