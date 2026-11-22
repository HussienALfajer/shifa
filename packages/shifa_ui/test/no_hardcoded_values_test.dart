// No colour, spacing or font family typed into lib/ outside the generated
// tokens file: every value comes from the theme (slice 0.4-08, criterion 10).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

final _rules = <String, RegExp>{
  'a Color literal': RegExp(r'Color\(\s*0x'),
  'a Color.from* literal': RegExp(r'Color\.from(ARGB|RGBO)\('),
  'an EdgeInsets literal': RegExp(
    r'EdgeInsets(Directional)?\.\w+\([^)]*\b\d+(\.\d+)?\b',
  ),
  'a font family string': RegExp(r'''fontFamily:\s*['"]'''),
  'a Material import': RegExp(r'package:flutter/(material|cupertino)\.dart'),
};

void main() {
  test('lib/ holds no hard-coded colours, insets or font families', () {
    final files = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => !f.path.replaceAll(r'\', '/').contains('/generated/'))
        .toList();
    expect(files, isNotEmpty);
    final problems = <String>[];
    for (final file in files) {
      final lines = file.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        final line = lines[i];
        if (line.trimLeft().startsWith('//')) continue;
        for (final MapEntry(key: what, value: rule) in _rules.entries) {
          if (rule.hasMatch(line)) {
            problems.add('${file.path}:${i + 1}: $what: ${line.trim()}');
          }
        }
      }
    }
    expect(problems, isEmpty, reason: problems.join('\n'));
  });

  test('the rules catch what they are meant to catch', () {
    const bad = [
      'color: Color(0xFF1F6F5C),',
      'padding: EdgeInsets.all(16),',
      'padding: EdgeInsetsDirectional.only(start: 12),',
      "fontFamily: 'Roboto',",
      "import 'package:flutter/material.dart';",
    ];
    for (final line in bad) {
      expect(
        _rules.values.any((rule) => rule.hasMatch(line)),
        isTrue,
        reason: line,
      );
    }
    const good = [
      'padding: EdgeInsets.all(spacing.space4),',
      'color: colors.brandPrimary,',
    ];
    for (final line in good) {
      expect(
        _rules.values.any((rule) => rule.hasMatch(line)),
        isFalse,
        reason: line,
      );
    }
  });
}
