// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:dio/dio.dart';

import 'clients/core_client.dart';

/// Shifa API `v0.0.0`
class ShifaApi {
  ShifaApi(Dio dio, {String? baseUrl}) : _dio = dio, _baseUrl = baseUrl;

  final Dio _dio;
  final String? _baseUrl;

  static String get version => '0.0.0';

  CoreClient? _core;

  CoreClient get core => _core ??= CoreClient(_dio, baseUrl: _baseUrl);
}
