import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AuthCacheService {
  static const _sessionKey = 'daily_mobile_session';

  Future<void> salvarSessaoDiaria({
    required String login,
    required Map<String, dynamic> session,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _sessionKey,
      jsonEncode({
        'login': _normalizeLogin(login),
        'session': session,
        'saved_at': DateTime.now().toIso8601String(),
      }),
    );
  }

  Future<Map<String, dynamic>?> loginOffline({
    required String login,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_sessionKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    final Map<String, dynamic> data;
    try {
      data = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      await limparSessao();
      return null;
    }

    if (data.containsKey('password_hash')) {
      await limparSessao();
      return null;
    }

    final storedLogin = (data['login'] ?? '').toString();
    final receivedLogin = _normalizeLogin(login);

    if (storedLogin != receivedLogin) {
      return null;
    }

    final session = data['session'];
    if (session is! Map) {
      await limparSessao();
      return null;
    }

    final resolvedSession = Map<String, dynamic>.from(session);
    final token = (resolvedSession['token'] ?? '').toString().trim();
    final expiresAt = _parseTokenExpiration(
      (resolvedSession['token_expira_em'] ?? '').toString(),
    );

    if (token.isEmpty || expiresAt == null || !expiresAt.isAfter(DateTime.now())) {
      await limparSessao();
      return null;
    }

    return resolvedSession;
  }

  Future<void> limparSessao() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionKey);
  }

  String _normalizeLogin(String login) {
    return login.trim().toLowerCase();
  }

  DateTime? _parseTokenExpiration(String value) {
    if (value.trim().isEmpty) {
      return null;
    }

    return DateTime.tryParse(value);
  }
}
