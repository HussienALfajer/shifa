// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'place_name_request.g.dart';

@JsonSerializable()
class PlaceNameRequest {
  const PlaceNameRequest({required this.name});

  factory PlaceNameRequest.fromJson(Map<String, Object?> json) =>
      _$PlaceNameRequestFromJson(json);

  final String name;

  Map<String, Object?> toJson() => _$PlaceNameRequestToJson(this);
}
