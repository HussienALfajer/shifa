/// Source of the current time. Production code receives a [Clock] instead of
/// calling `DateTime.now()`, so tests can pin time (appointment slots, queue
/// order). Mirrors `Clock` in `@shifa/testing`.
abstract interface class Clock {
  /// The current instant, always in UTC.
  DateTime now();
}

/// The real clock.
const Clock systemClock = _SystemClock();

class _SystemClock implements Clock {
  const new();

  @override
  DateTime now() => DateTime.now().toUtc();
}

/// A clock that only moves when the test moves it.
class FixedClock implements Clock {
  /// Starts the clock at [start].
  new(DateTime start) : _now = start.toUtc();

  /// Starts the clock at an ISO 8601 time; throws [FormatException] if invalid.
  factory parse(String start) => FixedClock(DateTime.parse(start));

  DateTime _now;

  @override
  DateTime now() => _now;

  /// Moves the clock forward by [by]; a negative duration throws [RangeError].
  void advanceBy(Duration by) {
    if (by.isNegative) {
      throw RangeError('FixedClock: time can only move forward');
    }
    _now = _now.add(by);
  }

  /// Moves the clock to [to]; moving backwards throws [RangeError].
  void set(DateTime to) {
    if (to.isBefore(_now)) {
      throw RangeError('FixedClock: time can only move forward');
    }
    _now = to.toUtc();
  }
}
