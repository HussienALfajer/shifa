// Encoding keeps the contract's optional fields absent: Zod `.optional()`
// rejects an explicit null, so a request body must never send one.
import 'package:api_client_dart/api_client_dart.dart';
import 'package:test/test.dart';

void main() {
  test('an absent optional field is omitted, not encoded as null', () {
    const body = ErrorBody(code: ErrorCode.notFound, message: 'Not found');
    expect(body.toJson().containsKey('details'), isFalse);
  });

  test('a present optional field is encoded', () {
    const body = ErrorBody(
      code: ErrorCode.validationFailed,
      message: 'Validation failed',
      details: [
        ValidationIssue(
          path: 'body.phone',
          code: ValidationIssueCode.invalidFormat,
        ),
      ],
    );
    expect(body.toJson()['details'], hasLength(1));
  });
}
