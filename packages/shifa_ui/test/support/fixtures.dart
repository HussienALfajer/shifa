// Synthetic people for shifa_ui tests and goldens (slice 0.4-12, P-N1): names
// from the generator in @shifa/testing, never typed in
// (.claude/rules/patient-data.md). Dart cannot run the TypeScript generator,
// so its output is copied here, as 0.4-10 did for phone numbers.
//
// Generated with: createRandom(412); for i = 0, 1, … generatePersonName(r, {
// sex: i odd ? 'male' : 'female', adult: true, region: i % 3 == 0 ? 'azaz' :
// 'aleppo' }), skipping a family name of two words and a repeated first
// letter, until four; each is `${given} ${family}`.

/// A synthetic person: the name a list shows and its avatar initials.
class Person {
  const new(this.name, this.initials);

  /// Given and family name.
  final String name;

  /// The first letter of each, the family's after «ال».
  final String initials;
}

/// Four generated people, each with a different first letter.
const people = [
  Person('نور السيد', 'ن س'),
  Person('حسن قباني', 'ح ق'),
  Person('ولاء المصري', 'و م'),
  Person('ماهر العمر', 'م ع'),
];
