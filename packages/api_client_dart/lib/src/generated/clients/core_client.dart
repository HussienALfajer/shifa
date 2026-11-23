// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/ended_sessions.dart';
import '../models/health_status.dart';
import '../models/session_list.dart';
import '../models/session_view.dart';
import '../models/sign_in_request.dart';

part 'core_client.g.dart';

@RestApi()
abstract class CoreClient {
  factory CoreClient(Dio dio, {String? baseUrl}) = _CoreClient;

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
}
