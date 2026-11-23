import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shifa_ui/shifa_ui.dart';

import '../support/fixtures.dart';
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
                title: people[0].name,
                subtitle: 'ملف 10482',
                leading: Builder(
                  builder: (c) => _avatar(c, people[0].initials),
                ),
                divided: true,
                onPressed: () {},
              ),
              ShifaListItem(
                title: people[1].name,
                subtitle: 'الخميس 26/11/2026 · 09:15',
                leading: Builder(
                  builder: (c) => _avatar(c, people[1].initials),
                ),
                trailing: const Text('مؤكد'),
                divided: true,
                onPressed: () {},
              ),
              ShifaListItem(
                title: people[2].name,
                subtitle: 'لا يمكن الحجز اليوم',
                leading: Builder(
                  builder: (c) => _avatar(c, people[2].initials),
                ),
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
          title: people[3].name,
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
