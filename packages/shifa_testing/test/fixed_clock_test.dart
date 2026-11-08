import 'package:shifa_testing/shifa_testing.dart';
import 'package:test/test.dart';

void main() {
  group('FixedClock', () {
    test('returns the start time in UTC until moved', () {
      final clock = FixedClock.parse('2026-11-08T09:00:00+03:00');
      expect(clock.now(), DateTime.utc(2026, 11, 8, 6));
      expect(clock.now().isUtc, isTrue);
      expect(clock.now(), clock.now());
    });

    test('advances by a duration', () {
      final clock = FixedClock(DateTime.utc(2026, 11, 8, 6))
        ..advanceBy(const Duration(minutes: 15));
      expect(clock.now(), DateTime.utc(2026, 11, 8, 6, 15));
    });

    test('rejects a negative advance', () {
      final clock = FixedClock(DateTime.utc(2026, 11, 8, 6));
      expect(
        () => clock.advanceBy(const Duration(milliseconds: -1)),
        throwsRangeError,
      );
    });

    test('moves forward with set but refuses to move backwards', () {
      final clock = FixedClock(DateTime.utc(2026, 11, 8, 6))
        ..set(DateTime.utc(2026, 11, 9));
      expect(clock.now(), DateTime.utc(2026, 11, 9));
      expect(() => clock.set(DateTime.utc(2026, 11, 8)), throwsRangeError);
    });

    test('rejects an invalid start time', () {
      expect(() => FixedClock.parse('not a date'), throwsFormatException);
    });

    test('systemClock implements Clock with the current time', () {
      expect(systemClock, isA<Clock>());
      final before = DateTime.now().toUtc();
      final now = systemClock.now();
      expect(now.isUtc, isTrue);
      expect(now.isBefore(before), isFalse);
    });
  });
}
