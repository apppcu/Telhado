import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';

class ApiService {
  const ApiService();

  Future<Map<String, dynamic>> loginTecnico({
    required String login,
    required String senha,
  }) async {
    return _postAction(
      action: 'login_tecnico_mobile',
      payload: {
        'login': login,
        'senha': senha,
      },
    );
  }

  Future<Map<String, dynamic>> trocarSenhaTecnico({
    required String token,
    required String novaSenha,
  }) async {
    return _postAction(
      action: 'trocar_senha_tecnico_mobile',
      payload: {
        'token': token,
        'nova_senha': novaSenha,
      },
    );
  }

  Future<List<Map<String, dynamic>>> listarChamadosTecnico({
    required String token,
  }) async {
    final data = await _postAction(
      action: 'listar_chamados_tecnico_mobile',
      payload: {
        'token': token,
      },
    );

    final chamados = data['chamados'] as List<dynamic>? ?? [];
    return chamados
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Future<Map<String, dynamic>> sync(List<Map<String, dynamic>> items) async {
    throw UnimplementedError('Configurar sincronizacao com Apps Script.');
  }

  Future<Map<String, dynamic>> _postAction({
    required String action,
    required Map<String, dynamic> payload,
  }) async {
    final uri = Uri.parse(AppConfig.apiBaseUrl);
    final response = await http.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'action': action,
        'payload': payload,
      }),
    );
    final resolvedResponse = await _followAppsScriptRedirect(response);

    if (resolvedResponse.statusCode < 200 ||
        resolvedResponse.statusCode >= 300) {
      throw Exception('Servidor indisponivel (${resolvedResponse.statusCode}).');
    }

    final body = jsonDecode(resolvedResponse.body) as Map<String, dynamic>;
    if (body['success'] != true) {
      final error = body['error'] as Map<String, dynamic>?;
      throw Exception(
        error?['message'] as String? ?? 'Operacao nao concluida.',
      );
    }

    return body['data'] as Map<String, dynamic>;
  }

  Future<http.Response> _followAppsScriptRedirect(http.Response response) async {
    if (!_isRedirect(response.statusCode)) {
      return response;
    }

    final location = response.headers['location'];
    if (location == null || location.isEmpty) {
      return response;
    }

    return http.get(
      Uri.parse(location),
      headers: const {'Accept': 'application/json'},
    );
  }

  bool _isRedirect(int statusCode) {
    return statusCode == 301 ||
        statusCode == 302 ||
        statusCode == 303 ||
        statusCode == 307 ||
        statusCode == 308;
  }
}

