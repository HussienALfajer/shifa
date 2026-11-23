// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/clinic_created.dart';
import '../models/clinic_detail.dart';
import '../models/clinic_list.dart';
import '../models/create_clinic_request.dart';
import '../models/ended_sessions.dart';
import '../models/health_status.dart';
import '../models/mfa_enrolled.dart';
import '../models/session_list.dart';
import '../models/session_view.dart';
import '../models/set_password_request.dart';
import '../models/setup_link_issued.dart';
import '../models/setup_link_request.dart';
import '../models/setup_link_view.dart';
import '../models/sign_in_request.dart';
import '../models/totp_challenge.dart';
import '../models/totp_enrol_confirm.dart';
import '../models/totp_enrol_start.dart';
import '../models/update_clinic_request.dart';

part 'core_client.g.dart';

@RestApi()
abstract class CoreClient {
  factory CoreClient(Dio dio, {String? baseUrl}) = _CoreClient;

  /// Pass the second factor for this session; rotates the session cookie
  @POST('/auth/mfa/challenge')
  Future<SessionView> authMfaChallenge({@Body() required TotpChallenge body});

  /// Confirm TOTP enrolment with one code; returns the recovery codes once
  @POST('/auth/mfa/enrol/confirm')
  Future<MfaEnrolled> authMfaEnrolConfirm({
    @Body() required TotpEnrolConfirm body,
  });

  /// Start TOTP enrolment: a new key (replaces an unconfirmed one)
  @POST('/auth/mfa/enrol/start')
  Future<TotpEnrolStart> authMfaEnrolStart();

  /// The current session
  @GET('/auth/session')
  Future<SessionView> authSession();

  /// The signed-in person’s sessions
  @GET('/auth/sessions')
  Future<SessionList> authSessions();

  /// End every session of the signed-in person but this one
  @POST('/auth/sessions/end-others')
  Future<EndedSessions> authEndOtherSessions();

  /// End one of the signed-in person’s sessions
  @DELETE('/auth/sessions/{id}')
  Future<void> authEndSession({@Path('id') required String id});

  /// Set the password through a setup link and sign in
  @POST('/auth/setup-link/consume')
  Future<SessionView> authSetupLinkConsume({
    @Body() required SetPasswordRequest body,
  });

  /// What a setup link is for, before the password is set
  @POST('/auth/setup-link/view')
  Future<SetupLinkView> authSetupLinkView({
    @Body() required SetupLinkRequest body,
  });

  /// Sign in with phone and password; sets the session cookie
  @POST('/auth/sign-in')
  Future<SessionView> authSignIn({@Body() required SignInRequest body});

  /// End this session and clear the cookie
  @POST('/auth/sign-out')
  Future<void> authSignOut();

  /// Liveness probe
  @GET('/health/live')
  Future<HealthStatus> healthLive();

  /// Readiness probe
  @GET('/health/ready')
  Future<HealthStatus> healthReady();

  /// Clinics, newest first; search by name
  @GET('/platform/clinics')
  Future<ClinicList> platformClinics({@Query('search') String? search});

  /// Create a clinic and its owner; returns the owner’s setup link once
  @POST('/platform/clinics')
  Future<ClinicCreated> platformCreateClinic({
    @Body() required CreateClinicRequest body,
  });

  /// A clinic and its owner card
  @GET('/platform/clinics/{id}')
  Future<ClinicDetail> platformClinic({@Path('id') required String id});

  /// Change a clinic’s status or subscription end date
  @PATCH('/platform/clinics/{id}')
  Future<ClinicDetail> platformUpdateClinic({
    @Path('id') required String id,
    @Body() required UpdateClinicRequest body,
  });

  /// End every session of the owner
  @POST('/platform/clinics/{id}/owner/end-sessions')
  Future<void> platformOwnerEndSessions({@Path('id') required String id});

  /// Reset the owner’s TOTP: enrol again at next sign-in (ends the owner’s sessions)
  @POST('/platform/clinics/{id}/owner/reset-mfa')
  Future<void> platformOwnerResetMfa({@Path('id') required String id});

  /// Issue a new setup link to the owner (ends the owner’s sessions)
  @POST('/platform/clinics/{id}/owner/setup-link')
  Future<SetupLinkIssued> platformOwnerSetupLink({
    @Path('id') required String id,
  });
}
