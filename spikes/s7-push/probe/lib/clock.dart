// Clock offset against the receiver (edge case "clock skew"): three `/time` calls on each open;
// the one with the lowest round trip gives offset = server time − local midpoint. Logged with
// every receipt so latency can be put on the receiver's clock.
import 'package:s7_push_probe/receiver_api.dart';

class ClockOffset {
  const new({this.offsetMs, this.rttMs});

  /// Add to local epoch ms to get the receiver's clock; null when never measured.
  final int? offsetMs;
  final int? rttMs;
}

Future<ClockOffset> measureClockOffset(
  ReceiverApi api, {
  int samples = 3,
  int Function()? nowMs,
}) async {
  final now = nowMs ?? () => DateTime.now().millisecondsSinceEpoch;
  ClockOffset? best;
  for (var i = 0; i < samples; i++) {
    final before = now();
    final server = await api.time();
    final after = now();
    final rtt = after - before;
    if (best == null || rtt < best.rttMs!) {
      best = ClockOffset(offsetMs: server - (before + rtt ~/ 2), rttMs: rtt);
    }
  }
  return best ?? const ClockOffset();
}
