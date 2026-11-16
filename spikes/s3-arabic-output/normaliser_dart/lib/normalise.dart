// Dart port of the Arabic name-search key (spec 0.3-S3 criterion 7, OD-40). Same steps, same
// order as spikes/s3-arabic-output/search/src/normalise.ts; the shared vector file holds both
// equal. Code points are written as \u{…} escapes so invisible characters stay visible.
import 'package:unorm_dart/unorm_dart.dart' as unorm;

/// Tashkeel, superscript alef, Quranic marks, tatweel and bidi controls: removed.
final _removed = RegExp(
  r'[\u{064B}-\u{065F}\u{0670}\u{06D6}-\u{06ED}\u{0640}\u{200E}\u{200F}'
  r'\u{202A}-\u{202E}\u{2066}-\u{2069}]',
  unicode: true,
);

/// أ إ آ ٱ → ا, ؤ → و, ئ → ي.
const _fold = <String, String>{
  '\u{0623}': '\u{0627}',
  '\u{0625}': '\u{0627}',
  '\u{0622}': '\u{0627}',
  '\u{0671}': '\u{0627}',
  '\u{0624}': '\u{0648}',
  '\u{0626}': '\u{064A}',
};
final _folded = RegExp(r'[\u{0622}-\u{0626}\u{0671}]', unicode: true);

/// An Arabic letter makes ة or ى "not word-final" (the same ranges as TS and SQL).
const _arabicLetter =
    r'\u{0620}-\u{063F}\u{0641}-\u{064A}\u{066E}\u{066F}\u{0671}-\u{06D3}'
    r'\u{06D5}\u{06EE}\u{06EF}\u{06FA}-\u{06FC}\u{06FF}';
final _finalTehMarbuta = RegExp('\\u{0629}(?![$_arabicLetter])', unicode: true);
final _finalAlefMaksura = RegExp(
  '\\u{0649}(?![$_arabicLetter])',
  unicode: true,
);

/// Arabic-Indic U+0660–0669 and Persian U+06F0–06F9 digits.
final _digits = RegExp(r'[\u{0660}-\u{0669}\u{06F0}-\u{06F9}]', unicode: true);

/// Only ASCII A–Z: identical in JavaScript, Dart and PostgreSQL whatever the locale.
final _latinUpper = RegExp('[A-Z]');

/// Unicode spaces, ZWSP, ZWNJ, ZWJ and BOM: each run becomes one space.
final _whitespace = RegExp(
  r'[\t\n\v\f\r \u{0085}\u{00A0}\u{1680}\u{2000}-\u{200D}\u{2028}\u{2029}'
  r'\u{202F}\u{205F}\u{3000}\u{FEFF}]+',
  unicode: true,
);

/// Compound-name particles after alef folding: عبد ابو ابي ام ابن بن بنت.
const _particles = <String>{
  '\u{0639}\u{0628}\u{062F}',
  '\u{0627}\u{0628}\u{0648}',
  '\u{0627}\u{0628}\u{064A}',
  '\u{0627}\u{0645}',
  '\u{0627}\u{0628}\u{0646}',
  '\u{0628}\u{0646}',
  '\u{0628}\u{0646}\u{062A}',
};

/// Removes the space after every particle that has a following word.
List<String> _joinParticles(List<String> words) {
  final out = <String>[];
  var pending = '';
  for (var i = 0; i < words.length; i++) {
    final word = words[i];
    if (_particles.contains(word) && i < words.length - 1) {
      pending += word;
    } else {
      out.add(pending + word);
      pending = '';
    }
  }
  return out;
}

/// The search key of [input]; the display name itself is never changed.
String normaliseName(String input) {
  var s = unorm.nfc(input);
  s = s.replaceAll(_removed, '');
  s = s.replaceAllMapped(_folded, (m) => _fold[m[0]!] ?? m[0]!);
  s = s
      .replaceAll(_finalTehMarbuta, '\u{0647}')
      .replaceAll(_finalAlefMaksura, '\u{064A}');
  s = s.replaceAllMapped(_digits, (m) {
    final code = m[0]!.codeUnitAt(0);
    return '${code >= 0x06F0 ? code - 0x06F0 : code - 0x0660}';
  });
  s = s.replaceAllMapped(_latinUpper, (m) => m[0]!.toLowerCase());
  s = s.replaceAll(_whitespace, ' ').trim();
  if (s.isEmpty) return '';
  // Two passes: the first can create a particle (بن + ت → بنت) that then joins its next word.
  final words = _joinParticles(_joinParticles(s.split(' ')));
  // Removing marks can leave a base letter next to a combining mark it now composes with.
  return unorm.nfc(words.join(' '));
}
