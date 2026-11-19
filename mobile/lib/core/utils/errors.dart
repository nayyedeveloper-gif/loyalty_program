import 'package:loyalty_mobile/core/api/api_exception.dart';

String getErrorMessage(Object error, [String fallback = 'Something went wrong']) {
  if (error is ApiException) {
    if (error.errors != null && error.errors!.isNotEmpty) {
      final first = error.errors!.values.first;
      if (first is List && first.isNotEmpty) return '${first.first}';
    }
    if (error.message.isNotEmpty) return error.message;
  }
  final text = '$error';
  return text.isEmpty ? fallback : text;
}
