import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:shifa_ui/src/generated/tokens.g.dart';

/// One locked status colour family: text, fill, outline and a solid fill with
/// its text. Locked colours mean one thing everywhere; no clinic theme changes
/// them.
@immutable
class ShifaTone {
  /// A family of five colours.
  const new({
    required this.fg,
    required this.bg,
    required this.border,
    required this.solid,
    required this.onSolid,
  });

  /// Text and icons of the status on a light fill.
  final Color fg;

  /// The light fill.
  final Color bg;

  /// The outline of a badge.
  final Color border;

  /// A solid fill (a danger button).
  final Color solid;

  /// Text and icons on [solid].
  final Color onSolid;

  List<Color> get _values => [fg, bg, border, solid, onSolid];

  /// The family a fraction [t] of the way to [other].
  ShifaTone lerp(ShifaTone other, double t) => ShifaTone(
    fg: Color.lerp(fg, other.fg, t)!,
    bg: Color.lerp(bg, other.bg, t)!,
    border: Color.lerp(border, other.border, t)!,
    solid: Color.lerp(solid, other.solid, t)!,
    onSolid: Color.lerp(onSolid, other.onSolid, t)!,
  );

  @override
  bool operator ==(Object other) =>
      other is ShifaTone && listEquals(_values, other._values);

  @override
  int get hashCode => Object.hashAll(_values);
}

/// One visit-queue state: text and fill.
@immutable
class ShifaQueueTone {
  /// A text colour and its fill.
  const new({required this.fg, required this.bg});

  /// Text and icons of the state.
  final Color fg;

  /// The fill of its pill.
  final Color bg;

  /// The pair a fraction [t] of the way to [other].
  ShifaQueueTone lerp(ShifaQueueTone other, double t) => ShifaQueueTone(
    fg: Color.lerp(fg, other.fg, t)!,
    bg: Color.lerp(bg, other.bg, t)!,
  );

  @override
  bool operator ==(Object other) =>
      other is ShifaQueueTone && other.fg == fg && other.bg == bg;

  @override
  int get hashCode => Object.hash(fg, bg);
}

/// The locked colours: status, clinical alerts and the visit queue. A status
/// is never shown by colour alone (an icon and a word come with it). Danger
/// is brick; critical is the only red in the product.
@immutable
class ShifaStatusColors {
  /// Every locked family of a theme; use [light] or [dark].
  const new({
    required this.success,
    required this.warning,
    required this.danger,
    required this.info,
    required this.neutral,
    required this.alertInfo,
    required this.alertWarning,
    required this.alertCritical,
    required this.queueBooked,
    required this.queueConfirmed,
    required this.queueArrived,
    required this.queueWaiting,
    required this.queueInRoom,
    required this.queueDone,
    required this.queueNoShow,
    required this.queueCancelled,
  });

  /// The locked colours of the light theme.
  static const light = ShifaStatusColors(
    success: ShifaTone(
      fg: ShifaColorsLight.colorStatusSuccessFg,
      bg: ShifaColorsLight.colorStatusSuccessBg,
      border: ShifaColorsLight.colorStatusSuccessBorder,
      solid: ShifaColorsLight.colorStatusSuccessSolid,
      onSolid: ShifaColorsLight.colorStatusSuccessOnSolid,
    ),
    warning: ShifaTone(
      fg: ShifaColorsLight.colorStatusWarningFg,
      bg: ShifaColorsLight.colorStatusWarningBg,
      border: ShifaColorsLight.colorStatusWarningBorder,
      solid: ShifaColorsLight.colorStatusWarningSolid,
      onSolid: ShifaColorsLight.colorStatusWarningOnSolid,
    ),
    danger: ShifaTone(
      fg: ShifaColorsLight.colorStatusDangerFg,
      bg: ShifaColorsLight.colorStatusDangerBg,
      border: ShifaColorsLight.colorStatusDangerBorder,
      solid: ShifaColorsLight.colorStatusDangerSolid,
      onSolid: ShifaColorsLight.colorStatusDangerOnSolid,
    ),
    info: ShifaTone(
      fg: ShifaColorsLight.colorStatusInfoFg,
      bg: ShifaColorsLight.colorStatusInfoBg,
      border: ShifaColorsLight.colorStatusInfoBorder,
      solid: ShifaColorsLight.colorStatusInfoSolid,
      onSolid: ShifaColorsLight.colorStatusInfoOnSolid,
    ),
    neutral: ShifaTone(
      fg: ShifaColorsLight.colorStatusNeutralFg,
      bg: ShifaColorsLight.colorStatusNeutralBg,
      border: ShifaColorsLight.colorStatusNeutralBorder,
      solid: ShifaColorsLight.colorStatusNeutralSolid,
      onSolid: ShifaColorsLight.colorStatusNeutralOnSolid,
    ),
    alertInfo: ShifaTone(
      fg: ShifaColorsLight.colorAlertInfoFg,
      bg: ShifaColorsLight.colorAlertInfoBg,
      border: ShifaColorsLight.colorAlertInfoBorder,
      solid: ShifaColorsLight.colorAlertInfoSolid,
      onSolid: ShifaColorsLight.colorAlertInfoOnSolid,
    ),
    alertWarning: ShifaTone(
      fg: ShifaColorsLight.colorAlertWarningFg,
      bg: ShifaColorsLight.colorAlertWarningBg,
      border: ShifaColorsLight.colorAlertWarningBorder,
      solid: ShifaColorsLight.colorAlertWarningSolid,
      onSolid: ShifaColorsLight.colorAlertWarningOnSolid,
    ),
    alertCritical: ShifaTone(
      fg: ShifaColorsLight.colorAlertCriticalFg,
      bg: ShifaColorsLight.colorAlertCriticalBg,
      border: ShifaColorsLight.colorAlertCriticalBorder,
      solid: ShifaColorsLight.colorAlertCriticalSolid,
      onSolid: ShifaColorsLight.colorAlertCriticalOnSolid,
    ),
    queueBooked: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueBookedFg,
      bg: ShifaColorsLight.colorQueueBookedBg,
    ),
    queueConfirmed: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueConfirmedFg,
      bg: ShifaColorsLight.colorQueueConfirmedBg,
    ),
    queueArrived: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueArrivedFg,
      bg: ShifaColorsLight.colorQueueArrivedBg,
    ),
    queueWaiting: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueWaitingFg,
      bg: ShifaColorsLight.colorQueueWaitingBg,
    ),
    queueInRoom: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueInRoomFg,
      bg: ShifaColorsLight.colorQueueInRoomBg,
    ),
    queueDone: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueDoneFg,
      bg: ShifaColorsLight.colorQueueDoneBg,
    ),
    queueNoShow: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueNoShowFg,
      bg: ShifaColorsLight.colorQueueNoShowBg,
    ),
    queueCancelled: ShifaQueueTone(
      fg: ShifaColorsLight.colorQueueCancelledFg,
      bg: ShifaColorsLight.colorQueueCancelledBg,
    ),
  );

  /// The locked colours of the dark theme.
  static const dark = ShifaStatusColors(
    success: ShifaTone(
      fg: ShifaColorsDark.colorStatusSuccessFg,
      bg: ShifaColorsDark.colorStatusSuccessBg,
      border: ShifaColorsDark.colorStatusSuccessBorder,
      solid: ShifaColorsDark.colorStatusSuccessSolid,
      onSolid: ShifaColorsDark.colorStatusSuccessOnSolid,
    ),
    warning: ShifaTone(
      fg: ShifaColorsDark.colorStatusWarningFg,
      bg: ShifaColorsDark.colorStatusWarningBg,
      border: ShifaColorsDark.colorStatusWarningBorder,
      solid: ShifaColorsDark.colorStatusWarningSolid,
      onSolid: ShifaColorsDark.colorStatusWarningOnSolid,
    ),
    danger: ShifaTone(
      fg: ShifaColorsDark.colorStatusDangerFg,
      bg: ShifaColorsDark.colorStatusDangerBg,
      border: ShifaColorsDark.colorStatusDangerBorder,
      solid: ShifaColorsDark.colorStatusDangerSolid,
      onSolid: ShifaColorsDark.colorStatusDangerOnSolid,
    ),
    info: ShifaTone(
      fg: ShifaColorsDark.colorStatusInfoFg,
      bg: ShifaColorsDark.colorStatusInfoBg,
      border: ShifaColorsDark.colorStatusInfoBorder,
      solid: ShifaColorsDark.colorStatusInfoSolid,
      onSolid: ShifaColorsDark.colorStatusInfoOnSolid,
    ),
    neutral: ShifaTone(
      fg: ShifaColorsDark.colorStatusNeutralFg,
      bg: ShifaColorsDark.colorStatusNeutralBg,
      border: ShifaColorsDark.colorStatusNeutralBorder,
      solid: ShifaColorsDark.colorStatusNeutralSolid,
      onSolid: ShifaColorsDark.colorStatusNeutralOnSolid,
    ),
    alertInfo: ShifaTone(
      fg: ShifaColorsDark.colorAlertInfoFg,
      bg: ShifaColorsDark.colorAlertInfoBg,
      border: ShifaColorsDark.colorAlertInfoBorder,
      solid: ShifaColorsDark.colorAlertInfoSolid,
      onSolid: ShifaColorsDark.colorAlertInfoOnSolid,
    ),
    alertWarning: ShifaTone(
      fg: ShifaColorsDark.colorAlertWarningFg,
      bg: ShifaColorsDark.colorAlertWarningBg,
      border: ShifaColorsDark.colorAlertWarningBorder,
      solid: ShifaColorsDark.colorAlertWarningSolid,
      onSolid: ShifaColorsDark.colorAlertWarningOnSolid,
    ),
    alertCritical: ShifaTone(
      fg: ShifaColorsDark.colorAlertCriticalFg,
      bg: ShifaColorsDark.colorAlertCriticalBg,
      border: ShifaColorsDark.colorAlertCriticalBorder,
      solid: ShifaColorsDark.colorAlertCriticalSolid,
      onSolid: ShifaColorsDark.colorAlertCriticalOnSolid,
    ),
    queueBooked: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueBookedFg,
      bg: ShifaColorsDark.colorQueueBookedBg,
    ),
    queueConfirmed: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueConfirmedFg,
      bg: ShifaColorsDark.colorQueueConfirmedBg,
    ),
    queueArrived: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueArrivedFg,
      bg: ShifaColorsDark.colorQueueArrivedBg,
    ),
    queueWaiting: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueWaitingFg,
      bg: ShifaColorsDark.colorQueueWaitingBg,
    ),
    queueInRoom: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueInRoomFg,
      bg: ShifaColorsDark.colorQueueInRoomBg,
    ),
    queueDone: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueDoneFg,
      bg: ShifaColorsDark.colorQueueDoneBg,
    ),
    queueNoShow: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueNoShowFg,
      bg: ShifaColorsDark.colorQueueNoShowBg,
    ),
    queueCancelled: ShifaQueueTone(
      fg: ShifaColorsDark.colorQueueCancelledFg,
      bg: ShifaColorsDark.colorQueueCancelledBg,
    ),
  );

  /// Done, saved, confirmed.
  final ShifaTone success;

  /// Needs attention soon.
  final ShifaTone warning;

  /// Destructive actions and failures (brick, not red).
  final ShifaTone danger;

  /// Neutral information.
  final ShifaTone info;

  /// No meaning attached.
  final ShifaTone neutral;

  /// A clinical alert: information.
  final ShifaTone alertInfo;

  /// A clinical alert: warning.
  final ShifaTone alertWarning;

  /// A clinical alert: critical (the only red).
  final ShifaTone alertCritical;

  /// Visit queue: booked.
  final ShifaQueueTone queueBooked;

  /// Visit queue: confirmed.
  final ShifaQueueTone queueConfirmed;

  /// Visit queue: arrived.
  final ShifaQueueTone queueArrived;

  /// Visit queue: waiting.
  final ShifaQueueTone queueWaiting;

  /// Visit queue: in the room.
  final ShifaQueueTone queueInRoom;

  /// Visit queue: done.
  final ShifaQueueTone queueDone;

  /// Visit queue: did not come.
  final ShifaQueueTone queueNoShow;

  /// Visit queue: cancelled.
  final ShifaQueueTone queueCancelled;

  List<ShifaTone> get _tones => [
    success,
    warning,
    danger,
    info,
    neutral,
    alertInfo,
    alertWarning,
    alertCritical,
  ];

  List<ShifaQueueTone> get _queue => [
    queueBooked,
    queueConfirmed,
    queueArrived,
    queueWaiting,
    queueInRoom,
    queueDone,
    queueNoShow,
    queueCancelled,
  ];

  /// The locked colours a fraction [t] of the way to [other].
  ShifaStatusColors lerp(ShifaStatusColors other, double t) {
    final tones = [
      for (var i = 0; i < _tones.length; i++)
        _tones[i].lerp(other._tones[i], t),
    ];
    final queue = [
      for (var i = 0; i < _queue.length; i++)
        _queue[i].lerp(other._queue[i], t),
    ];
    return ShifaStatusColors(
      success: tones[0],
      warning: tones[1],
      danger: tones[2],
      info: tones[3],
      neutral: tones[4],
      alertInfo: tones[5],
      alertWarning: tones[6],
      alertCritical: tones[7],
      queueBooked: queue[0],
      queueConfirmed: queue[1],
      queueArrived: queue[2],
      queueWaiting: queue[3],
      queueInRoom: queue[4],
      queueDone: queue[5],
      queueNoShow: queue[6],
      queueCancelled: queue[7],
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ShifaStatusColors &&
      listEquals(_tones, other._tones) &&
      listEquals(_queue, other._queue);

  @override
  int get hashCode =>
      Object.hash(Object.hashAll(_tones), Object.hashAll(_queue));
}
