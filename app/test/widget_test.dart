import 'package:chuva_app/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows login screen', (tester) async {
    await tester.pumpWidget(const ChuvaApp());

    expect(find.text('Controle Telhado'), findsOneWidget);
    expect(find.text('Entrar'), findsOneWidget);
  });
}
