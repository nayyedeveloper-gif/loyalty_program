import 'package:intl/intl.dart';

String formatMMK(num? amount) {
  final value = amount ?? 0;
  final formatted = NumberFormat('#,##0').format(value);
  return '$formatted MMK';
}

String formatPoints(num? points) {
  return NumberFormat('#,##0').format(points ?? 0);
}

String formatDate(String? iso, {String locale = 'en'}) {
  if (iso == null || iso.isEmpty) return '—';
  final dt = DateTime.tryParse(iso);
  if (dt == null) return iso;
  final local = dt.toLocal();
  // Avoid intl locale init (my/en_GB) — use a stable en pattern everywhere.
  return DateFormat('d MMM yyyy').format(local);
}
