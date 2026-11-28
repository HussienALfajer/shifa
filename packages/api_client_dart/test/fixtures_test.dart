// Shared response fixtures (packages/contracts/fixtures/responses.json)
// decode through the generated models, so the Dart and TypeScript clients
// are tested on the same data.
import 'dart:convert';
import 'dart:io';

import 'package:api_client_dart/api_client_dart.dart';
import 'package:test/test.dart';

typedef _Json = Map<String, dynamic>;

final _decoders = <String, Object Function(_Json)>{
  'HealthStatus': (json) => HealthStatus.fromJson(json).toJson(),
  'ErrorEnvelope': (json) => ErrorEnvelope.fromJson(json).toJson(),
  'SessionView': (json) => SessionView.fromJson(json).toJson(),
  'SessionList': (json) => SessionList.fromJson(json).toJson(),
  'EndedSessions': (json) => EndedSessions.fromJson(json).toJson(),
  'SetupLinkView': (json) => SetupLinkView.fromJson(json).toJson(),
  'TotpEnrolStart': (json) => TotpEnrolStart.fromJson(json).toJson(),
  'MfaEnrolled': (json) => MfaEnrolled.fromJson(json).toJson(),
  'ClinicList': (json) => ClinicList.fromJson(json).toJson(),
  'ClinicCreated': (json) => ClinicCreated.fromJson(json).toJson(),
  'MemberDetail': (json) => MemberDetail.fromJson(json).toJson(),
  'InvitationView': (json) => InvitationView.fromJson(json).toJson(),
  'PermissionDefaults': (json) => PermissionDefaults.fromJson(json).toJson(),
  'ClinicSettings': (json) => ClinicSettings.fromJson(json).toJson(),
  'BranchList': (json) => BranchList.fromJson(json).toJson(),
  'ArchiveBranchPreview': (json) =>
      ArchiveBranchPreview.fromJson(json).toJson(),
  'MyClinics': (json) => MyClinics.fromJson(json).toJson(),
  'ActiveClinic': (json) => ActiveClinic.fromJson(json).toJson(),
  'MyProfile': (json) => MyProfile.fromJson(json).toJson(),
  'MfaStatus': (json) => MfaStatus.fromJson(json).toJson(),
  'RecoveryCodes': (json) => RecoveryCodes.fromJson(json).toJson(),
  'MfaPassed': (json) => MfaPassed.fromJson(json).toJson(),
  'ClinicEntitlements': (json) => ClinicEntitlements.fromJson(json).toJson(),
  'EntitlementItem': (json) => EntitlementItem.fromJson(json).toJson(),
  'OverrideHistory': (json) => OverrideHistory.fromJson(json).toJson(),
  'TypePreview': (json) => TypePreview.fromJson(json).toJson(),
  // A-02-03
  'Capabilities': (json) => Capabilities.fromJson(json).toJson(),
  'Subscription': (json) => Subscription.fromJson(json).toJson(),
  'FlagList': (json) => FlagList.fromJson(json).toJson(),
  'FlagView': (json) => FlagView.fromJson(json).toJson(),
  // A-02-04
  'ClinicSettingList': (json) => ClinicSettingList.fromJson(json).toJson(),
  'SettingView': (json) => SettingView.fromJson(json).toJson(),
  'PlatformSupportGrants': (json) =>
      PlatformSupportGrants.fromJson(json).toJson(),
  'ClinicSupportGrants': (json) => ClinicSupportGrants.fromJson(json).toJson(),
  // A-02-06
  'CityList': (json) => CityList.fromJson(json).toJson(),
  'City': (json) => City.fromJson(json).toJson(),
  'ClinicPlaces': (json) => ClinicPlaces.fromJson(json).toJson(),
  // A-02-07
  'AnnouncementList': (json) => AnnouncementList.fromJson(json).toJson(),
  'MyAnnouncements': (json) => MyAnnouncements.fromJson(json).toJson(),
  'ClinicUsage': (json) => ClinicUsage.fromJson(json).toJson(),
  // A-03-02
  'PatientChart': (json) => PatientChart.fromJson(json).toJson(),
  'PatientCount': (json) => PatientCount.fromJson(json).toJson(),
  // A-03-03
  'PatientSearchResults': (json) =>
      PatientSearchResults.fromJson(json).toJson(),
  'PatientSearchResult': (json) => PatientSearchResult.fromJson(json).toJson(),
  // A-03-04: duplicates, family and treating doctors.
  'DuplicateCandidates': (json) => DuplicateCandidates.fromJson(json).toJson(),
  'DuplicateCandidate': (json) => DuplicateCandidate.fromJson(json).toJson(),
  'PatientFamily': (json) => PatientFamily.fromJson(json).toJson(),
  'FamilyMember': (json) => FamilyMember.fromJson(json).toJson(),
  'PatientDoctors': (json) => PatientDoctors.fromJson(json).toJson(),
  'TreatingDoctor': (json) => TreatingDoctor.fromJson(json).toJson(),
  // A-03-05: custom field definitions (the owner's view) and the form's fields.
  'PatientFieldDefinitions': (json) =>
      PatientFieldDefinitions.fromJson(json).toJson(),
  'PatientFormFields': (json) => PatientFormFields.fromJson(json).toJson(),
};

_Json _readFixtures() {
  final file = File('../contracts/fixtures/responses.json');
  return jsonDecode(file.readAsStringSync()) as _Json;
}

/// JSON as it would go over the wire: nested models encoded, absent optional
/// fields dropped.
Object? _wire(Object? value) => _withoutNulls(jsonDecode(jsonEncode(value)));

Object? _withoutNulls(Object? value) => switch (value) {
  final Map<String, dynamic> map => {
    for (final e in map.entries)
      if (e.value != null) e.key: _withoutNulls(e.value),
  },
  final List<dynamic> list => list.map(_withoutNulls).toList(),
  _ => value,
};

void main() {
  final fixtures = _readFixtures();
  final valid = (fixtures['valid'] as List<dynamic>).cast<_Json>();
  final invalid = (fixtures['invalid'] as List<dynamic>).cast<_Json>();

  group('valid fixtures', () {
    for (final fixture in valid) {
      test('decode and round-trip: ${fixture['name']}', () {
        final decode = _decoders[fixture['schema']];
        expect(
          decode,
          isNotNull,
          reason: 'no decoder for ${fixture['schema']}',
        );
        final body = fixture['body'] as _Json;
        final encoded = _wire(decode!(body));
        if (fixture['extraFields'] == true) {
          // Fields added later are ignored, never fatal.
          expect(encoded, isA<Map<String, dynamic>>());
        } else {
          expect(encoded, equals(_wire(body)));
        }
      });
    }
  });

  group('invalid fixtures', () {
    for (final fixture in invalid) {
      test('are rejected: ${fixture['name']}', () {
        final decode = _decoders[fixture['schema']]!;
        expect(() => decode(fixture['body'] as _Json), throwsA(anything));
      });
    }
  });

  group('generated models keep the contract', () {
    test('an unknown error code is rejected, not mapped to a fallback', () {
      expect(
        () => ErrorEnvelope.fromJson({
          'error': {'code': 'im_a_teapot', 'message': 'Teapot'},
        }),
        throwsA(anything),
      );
    });

    test('string enums are exhaustive and keep their wire values', () {
      final codes = valid
          .where((f) => f['schema'] == 'ErrorEnvelope')
          .map((f) => ((f['body'] as _Json)['error'] as _Json)['code'])
          .toSet();
      expect(ErrorCode.values, hasLength(codes.length));
      // Zod's eleven issue codes and the API's own area_not_in_city (A-02-06).
      expect(ValidationIssueCode.values, hasLength(12));
    });

    test('required fields are non-null and optional fields stay nullable', () {
      final envelope = ErrorEnvelope.fromJson({
        'error': {'code': 'not_found', 'message': 'Not found'},
      });
      // The explicit non-null types below are the check: they stop compiling
      // if the generator makes a required field nullable.
      // ignore: omit_local_variable_types
      final ErrorBody body = envelope.error;
      // Non-null type is the check.
      // ignore: omit_local_variable_types
      final String message = body.message;
      // Non-null type is the check.
      // ignore: omit_local_variable_types
      final ErrorCode code = body.code;
      expect(message, 'Not found');
      expect(code, ErrorCode.notFound);
      expect(body.details, isNull);

      final issues = ErrorEnvelope.fromJson({
        'error': {
          'code': 'validation_failed',
          'message': 'Validation failed',
          'details': [
            {'path': 'body.phone', 'code': 'invalid_format'},
          ],
        },
      }).error.details;
      expect(issues, hasLength(1));
      // Non-null type is the check.
      // ignore: omit_local_variable_types
      final String path = issues!.single.path;
      expect(path, 'body.phone');
      expect(issues.single.code, ValidationIssueCode.invalidFormat);
    });
  });
}
