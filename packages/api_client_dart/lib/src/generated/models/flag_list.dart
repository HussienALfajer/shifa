// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'flag_view.dart';

part 'flag_list.g.dart';

@JsonSerializable()
class FlagList {
  const FlagList({required this.flags});

  factory FlagList.fromJson(Map<String, Object?> json) =>
      _$FlagListFromJson(json);

  final List<FlagView> flags;

  Map<String, Object?> toJson() => _$FlagListToJson(this);
}
