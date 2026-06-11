class PaginatedResponse<T> {
  PaginatedResponse({required this.data, required this.meta});

  final List<T> data;
  final PaginationMeta meta;

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    final raw = json['data'] as List<dynamic>? ?? [];
    return PaginatedResponse(
      data: raw.map((e) => fromJsonT(e as Map<String, dynamic>)).toList(),
      meta: PaginationMeta.fromJson(json['meta'] as Map<String, dynamic>? ?? {}),
    );
  }
}

class PaginationMeta {
  PaginationMeta({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory PaginationMeta.fromJson(Map<String, dynamic> json) => PaginationMeta(
        page: json['page'] as int? ?? 1,
        limit: json['limit'] as int? ?? 50,
        total: json['total'] as int? ?? 0,
        totalPages: json['totalPages'] as int? ?? 1,
      );
}
