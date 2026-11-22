import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// The families shifa_ui ships, with the OFL file the tokens build copies
/// beside them. "Shifa Sans Arabic" is IBM Plex Sans Arabic (OD-59).
const _licences = [
  ('Shifa Sans Arabic (IBM Plex Sans Arabic)', 'ibm-plex-sans-arabic-OFL.txt'),
  ('Noto Naskh Arabic', 'noto-naskh-arabic-OFL.txt'),
];

/// Adds the SIL Open Font Licence of both font families to the app's licence
/// page. Call it once in `main()`; [bundle] is for tests.
void registerShifaFontLicences({AssetBundle? bundle}) {
  LicenseRegistry.addLicense(() async* {
    for (final (family, file) in _licences) {
      final text = await (bundle ?? rootBundle).loadString(
        'packages/shifa_ui/fonts/$file',
      );
      yield LicenseEntryWithLineBreaks([family], text);
    }
  });
}
