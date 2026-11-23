import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// The families shifa_ui ships, with the OFL file the tokens build copies
/// beside them. "Shifa Sans Arabic" is IBM Plex Sans Arabic (OD-59).
const _fontLicences = [
  ('Shifa Sans Arabic (IBM Plex Sans Arabic)', 'ibm-plex-sans-arabic-OFL.txt'),
  ('Noto Naskh Arabic', 'noto-naskh-arabic-OFL.txt'),
];

/// The Solar icons the painters of `glyphs.g.dart` draw (OD-65): their
/// licence asks for credit and a link to it, given on the licence page.
const _solarLicence =
    'Solar icon set (Broken style) by 480 Design.\n\n'
    'Licensed under the Creative Commons Attribution 4.0 International '
    'licence (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/\n\n'
    'The icons are redrawn as Flutter painters from @iconify-json/solar; '
    'some are mirrored for right-to-left screens.';

/// Adds the licences of what shifa_ui ships to the app's licence page: the
/// SIL Open Font Licence of both font families and the Solar icons' CC BY
/// 4.0 (slice 0.4-12, P-N7). Call it once in `main()`; [bundle] is for tests.
void registerShifaLicences({AssetBundle? bundle}) {
  LicenseRegistry.addLicense(() async* {
    for (final (family, file) in _fontLicences) {
      final text = await (bundle ?? rootBundle).loadString(
        'packages/shifa_ui/fonts/$file',
      );
      yield LicenseEntryWithLineBreaks([family], text);
    }
    yield const LicenseEntryWithLineBreaks(['Solar icons'], _solarLicence);
  });
}
