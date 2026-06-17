class ImportResult {
  const ImportResult({
    this.dryRun = false,
    this.sheets = const [],
    this.counts = const {},
    this.warnings = const [],
    this.errors = const [],
    this.validation,
  });

  final bool dryRun;
  final List<String> sheets;
  final Map<String, int> counts;
  final List<String> warnings;
  final List<String> errors;
  final Map<String, String>? validation;

  bool get hasErrors => errors.isNotEmpty;

  factory ImportResult.fromJson(Map<String, dynamic> json) {
    final rawCounts = json['counts'];
    final counts = <String, int>{};
    if (rawCounts is Map) {
      rawCounts.forEach((k, v) {
        counts['$k'] = v is int ? v : int.tryParse('$v') ?? 0;
      });
    }

    final rawValidation = json['validation'];
    Map<String, String>? validation;
    if (rawValidation is Map) {
      validation = rawValidation.map((k, v) => MapEntry('$k', '$v'));
    }

    return ImportResult(
      dryRun: json['dryRun'] == true,
      sheets: (json['sheets'] as List<dynamic>? ?? []).map((e) => '$e').toList(),
      counts: counts,
      warnings: (json['warnings'] as List<dynamic>? ?? []).map((e) => '$e').toList(),
      errors: (json['errors'] as List<dynamic>? ?? []).map((e) => '$e').toList(),
      validation: validation,
    );
  }
}
