import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support.dart';

Widget _appointment(BuildContext context) {
  final shifa = context.shifa;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'موعدك القادم',
        style: shifa.typography.labelSm.copyWith(color: shifa.colors.textMuted),
      ),
      Text('د. نادر الخطيب · أسنان', style: shifa.typography.titleSm),
      Text(
        'الثلاثاء 24/11/2026 · 10:30',
        style: shifa.typography.paragraphData.copyWith(
          color: shifa.colors.textMuted,
        ),
      ),
    ],
  );
}

void main() {
  group('ShifaCard', () {
    shifaGoldenTest(
      'plain and pressable, RTL, light and dark',
      fileName: 'card',
      states: {
        'plain': const ShifaCard(child: Builder(builder: _appointment)),
        'pressable': ShifaCard(
          onPressed: () {},
          child: const Builder(builder: _appointment),
        ),
      },
    );
    shifaGoldenTest(
      'pressed, RTL, light and dark',
      fileName: 'card_pressed',
      whilePerforming: pressAll(find.byType(ShifaCard)),
      states: {
        'pressed': ShifaCard(
          onPressed: () {},
          child: const Builder(builder: _appointment),
        ),
      },
    );
  });

  group('ShifaChip', () {
    shifaGoldenTest(
      'selected, at rest and disabled, RTL, light and dark',
      fileName: 'chip',
      states: {
        'selected · rest · disabled': Wrap(
          spacing: 8,
          children: [
            ShifaChip(label: 'الكل', selected: true, onSelected: (_) {}),
            ShifaChip(label: 'القادمة', selected: false, onSelected: (_) {}),
            const ShifaChip(
              label: 'الملغاة',
              selected: false,
              onSelected: null,
            ),
          ],
        ),
      },
    );
  });
}
