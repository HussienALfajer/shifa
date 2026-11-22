import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:shifa_ui/src/theme/metrics.dart';
import 'package:shifa_ui/src/theme/theme.dart';

/// The four jasmine petals of the logo lighting in turn (the web Spinner):
/// a wait without a known shape. Still under reduced motion. Inside a busy
/// button it is the button's mark and says nothing itself.
class ShifaSpinner extends StatefulWidget {
  /// A spinner of [size] (20 in controls) in [color] (the ambient icon
  /// colour); [label] is what a screen reader hears when it stands alone.
  const new({this.size = 20, this.color, this.label, super.key});

  /// The side of the square.
  final double size;

  /// The petals' colour.
  final Color? color;

  /// What a screen reader says; none inside a control that already says it
  /// is busy.
  final String? label;

  @override
  State<ShifaSpinner> createState() => _ShifaSpinnerState();
}

class _ShifaSpinnerState extends State<ShifaSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _turn = AnimationController(vsync: this);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final step = ShifaMotion.duration(context, context.shifa.motion.base);
    if (step == Duration.zero) {
      _turn.stop();
    } else {
      // One petal per step; four steps a turn.
      _turn.duration = step * 4;
      if (!_turn.isAnimating) _turn.repeat();
    }
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color ?? IconTheme.of(context).color!;
    final petals = AnimatedBuilder(
      animation: _turn,
      builder: (context, _) => CustomPaint(
        size: Size.square(widget.size),
        painter: _PetalsPainter(color, (_turn.value * 4).floor() % 4),
      ),
    );
    return Semantics(
      label: widget.label,
      liveRegion: widget.label != null,
      excludeSemantics: true,
      child: petals,
    );
  }
}

class _PetalsPainter extends CustomPainter {
  const new(this.color, this.lit);

  final Color color;

  /// The petal that is fully lit; the others fade behind it.
  final int lit;

  // Top-start, top-end, bottom-end, bottom-start on a 40 grid (the logo).
  static const _centres = [
    Offset(12, 12),
    Offset(28, 12),
    Offset(28, 28),
    Offset(12, 28),
  ];
  static const _fade = [1.0, 0.55, 0.3, 0.15];

  @override
  void paint(Canvas canvas, Size size) {
    canvas
      ..save()
      ..scale(size.width / 40);
    for (var i = 0; i < 4; i++) {
      final centre = _centres[i];
      final paint = Paint()
        ..color = color.withValues(alpha: color.a * _fade[(lit - i) % 4]);
      canvas
        ..save()
        ..translate(centre.dx, centre.dy)
        ..rotate((i.isEven ? -1 : 1) * math.pi / 4)
        ..drawOval(
          Rect.fromCenter(center: Offset.zero, width: 9, height: 16),
          paint,
        )
        ..restore();
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_PetalsPainter old) =>
      old.color != color || old.lit != lit;
}
