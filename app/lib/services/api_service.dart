import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

import '../config.dart';

class ApiService {
  const ApiService();
  static const Duration _requestTimeout = Duration(seconds: 25);

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

  Future<Map<String, dynamic>> iniciarVistoriaTecnico({
    required String token,
    required String chamadoId,
  }) async {
    return _postAction(
      action: 'iniciar_vistoria_tecnico_mobile',
      payload: {
        'token': token,
        'chamado_id': chamadoId,
      },
    );
  }

  Future<Map<String, dynamic>> salvarVistoriaTecnico({
    required String token,
    required String chamadoId,
    required String observacaoTecnica,
    required String materiais,
    required String ferramentas,
    required bool resolverNaHora,
  }) async {
    return _postAction(
      action: 'salvar_vistoria_tecnico_mobile',
      payload: {
        'token': token,
        'chamado_id': chamadoId,
        'observacao_tecnica': observacaoTecnica,
        'materiais': materiais,
        'ferramentas': ferramentas,
        'resolver_na_hora': resolverNaHora,
      },
    );
  }

  Future<Map<String, dynamic>> iniciarReparoTecnico({
    required String token,
    required String chamadoId,
  }) async {
    return _postAction(
      action: 'iniciar_reparo_tecnico_mobile',
      payload: {
        'token': token,
        'chamado_id': chamadoId,
      },
    );
  }

  Future<Map<String, dynamic>> reabrirVistoriaTecnico({
    required String token,
    required String chamadoId,
    required String justificativa,
  }) async {
    return _postAction(
      action: 'reabrir_vistoria_tecnico_mobile',
      payload: {
        'token': token,
        'chamado_id': chamadoId,
        'justificativa': justificativa,
      },
    );
  }

  Future<Map<String, dynamic>> concluirReparoTecnico({
    required String token,
    required String chamadoId,
    required String servicoExecutado,
    required String observacaoFinal,
  }) async {
    return _postAction(
      action: 'concluir_reparo_tecnico_mobile',
      payload: {
        'token': token,
        'chamado_id': chamadoId,
        'servico_executado': servicoExecutado,
        'observacao_final': observacaoFinal,
      },
    );
  }

  Future<Map<String, dynamic>> executarAcaoMobile({
    required String action,
    required Map<String, dynamic> payload,
  }) async {
    return _postAction(action: action, payload: payload);
  }

  Future<Map<String, dynamic>> sync(List<Map<String, dynamic>> items) async {
    throw UnimplementedError('Configurar sincronizacao com Apps Script.');
  }

  Future<Map<String, dynamic>> _postAction({
    required String action,
    required Map<String, dynamic> payload,
  }) async {
    final uri = Uri.parse(AppConfig.apiBaseUrl);
    final response = await http
        .post(
          uri,
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({
            'action': action,
            'payload': payload,
          }),
        )
        .timeout(_requestTimeout, onTimeout: _onRequestTimeout);
    final resolvedResponse = await _followAppsScriptRedirect(response);

    if (resolvedResponse.statusCode < 200 ||
        resolvedResponse.statusCode >= 300) {
      throw Exception('Servidor indisponivel (${resolvedResponse.statusCode}).');
    }

    late final Map<String, dynamic> body;
    try {
      body = jsonDecode(resolvedResponse.body) as Map<String, dynamic>;
    } on FormatException {
      throw const ApiException(
        code: 'RESPOSTA_INVALIDA',
        message:
            'Resposta invalida do servidor. Atualize o deploy do GAS e tente novamente.',
      );
    }
    if (body['success'] != true) {
      final error = body['error'] as Map<String, dynamic>?;
      throw ApiException(
        code: error?['code'] as String? ?? 'API_ERROR',
        message: error?['message'] as String? ?? 'Operacao nao concluida.',
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

    return http
        .get(
          Uri.parse(location),
          headers: const {'Accept': 'application/json'},
        )
        .timeout(_requestTimeout, onTimeout: _onRequestTimeout);
  }

  http.Response _onRequestTimeout() {
    throw const ApiException(
      code: 'TIMEOUT',
      message:
          'Servidor demorou para responder. Verifique a conexao e tente novamente.',
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

class ApiException implements Exception {
  final String code;
  final String message;

  const ApiException({
    required this.code,
    required this.message,
  });

  @override
  String toString() {
    return message;
  }
}

