import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import 'support.dart';

Widget _avatar(BuildContext context, String initials) {
  final c = context.shifa.colors;
  return Container(
    width: context.shifa.spacing.space8 + context.shifa.spacing.space2,
    height: context.shifa.spacing.space8 + context.shifa.spacing.space2,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: c.selectionDefault,
      shape: BoxShape.circle,
    ),
    child: Text(initials, style: context.shifa.typography.labelSm),
  );
}

void main() {
  group('ShifaListItem', () {
    shifaGoldenTest(
      'rows in a card list, RTL, light and dark',
      fileName: 'list_item',
      states: {
        'list': ShifaCard(
          child: Column(
            children: [
              ShifaListItem(
                title: 'ريم العلي',
                subtitle: 'ملف 10482',
                leading: Builder(builder: (c) => _avatar(c, 'ر ع')),
                divided: true,
                onPressed: () {},
              ),
              ShifaListItem(
                title: 'محمد الحلبي',
                subtitle: 'الخميس 26/11/2026 · 09:15',
                leading: Builder(builder: (c) => _avatar(c, 'م ح')),
                trailing: const Text('مؤكد'),
                divided: true,
                onPressed: () {},
              ),
              ShifaListItem(
                title: 'عمر الخوري',
                subtitle: 'لا يمكن الحجز اليوم',
                leading: Builder(builder: (c) => _avatar(c, 'ع خ')),
                enabled: false,
                onPressed: () {},
              ),
            ],
          ),
        ),
        // A Latin value in an Arabic row is set left to right on its own.
        'plain row': const ShifaListItem(
          title: 'فصيلة الدم',
          trailing: Text('O+', textDirection: TextDirection.ltr),
        ),
      },
    );
    shifaGoldenTest(
      'pressed, RTL, light and dark',
      fileName: 'list_item_pressed',
      whilePerforming: pressAll(find.byType(ShifaListItem)),
      states: {
        'pressed': ShifaListItem(
          title: 'ليلى حداد',
          subtitle: 'ملف 10517',
          onPressed: () {},
        ),
      },
    );
  });

  group('ShifaAppBar', () {
    shifaGoldenTest(
      'root, back with actions, long title; RTL, light and dark',
      fileName: 'app_bar',
      width: 390,
      states: {
        'root': ShifaAppBar(
          title: 'مواعيدي',
          actions: [
            ShifaIconButton(
              glyph: ShifaGlyphs.bell,
              label: 'الإشعارات',
              onPressed: () {},
            ),
          ],
        ),
        'back and more': ShifaAppBar(
          title: 'تفاصيل الموعد',
          onBack: () {},
          actions: [
            ShifaIconButton(
              glyph: ShifaGlyphs.more,
              label: 'المزيد',
              onPressed: () {},
            ),
          ],
        ),
        'long title': ShifaAppBar(
          title: 'عيادة الشهباء لطب الأسنان والتقويم وجراحة الفم',
          onBack: () {},
        ),
      },
    );
  });
}
