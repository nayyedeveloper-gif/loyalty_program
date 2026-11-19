import 'package:flutter_test/flutter_test.dart';
import 'package:loyalty_mobile/app.dart';

void main() {
  testWidgets('App boots', (tester) async {
    await tester.pumpWidget(const LoyaltyApp());
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.byType(LoyaltyApp), findsOneWidget);
  });
}
