import 'package:flutter/material.dart';

import 'config.dart';
import 'pages/login_page.dart';

void main() {
  runApp(const ChuvaApp());
}

class ChuvaApp extends StatelessWidget {
  const ChuvaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF12624F),
      ),
      home: const LoginPage(),
    );
  }
}

