import 'package:material_ui/material_ui.dart';

import '../../core/strings/app_strings.dart';
import '../../core/theme/app_theme.dart';

/// Rótulos e cores dos status e prioridades da API (valores em inglês, texto em português).
String statusLabel(String status) => switch (status) {
  'NEW' => AppStrings.statusNew,
  'IN_REVIEW' => AppStrings.statusInReview,
  'SCHEDULED' => AppStrings.statusScheduled,
  'DONE' => AppStrings.statusDone,
  _ => status,
};

Color statusColor(String status) => switch (status) {
  'NEW' => AppColors.warning,
  'IN_REVIEW' => AppColors.brand,
  'SCHEDULED' => AppColors.brand,
  'DONE' => AppColors.success,
  _ => AppColors.muted,
};

String priorityLabel(String priority) => switch (priority) {
  'HIGH' => AppStrings.priorityHigh,
  'MEDIUM' => AppStrings.priorityMedium,
  'LOW' => AppStrings.priorityLow,
  _ => priority,
};

const List<String> priorities = ['HIGH', 'MEDIUM', 'LOW'];
