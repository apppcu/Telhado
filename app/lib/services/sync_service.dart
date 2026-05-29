import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';

import 'api_service.dart';
import 'camera_service.dart';
import 'local_db_service.dart';

class SyncService {
  SyncService({
    LocalDbService? localDb,
    ApiService? api,
    CameraService? camera,
    Connectivity? connectivity,
  })  : _localDb = localDb ?? LocalDbService.instance,
        _api = api ?? const ApiService(),
        _camera = camera ?? CameraService(),
        _connectivity = connectivity ?? Connectivity();

  final LocalDbService _localDb;
  final ApiService _api;
  final CameraService _camera;
  final Connectivity _connectivity;
  static Future<SyncResult>? _activeSync;

  Future<int> enfileirar({
    required String action,
    required Map<String, dynamic> payload,
    String? photoPath,
  }) {
    return _localDb.enfileirarOperacao(
      action: action,
      payload: payload,
      photoPath: photoPath,
    );
  }

  Future<SyncResult> sincronizarPendencias({String? tokenAtual}) {
    final active = _activeSync;
    if (active != null) {
      return active;
    }

    final sync = _sincronizarPendencias(tokenAtual: tokenAtual);
    _activeSync = sync;
    return sync.whenComplete(() {
      if (identical(_activeSync, sync)) {
        _activeSync = null;
      }
    });
  }

  Future<SyncResult> _sincronizarPendencias({String? tokenAtual}) async {
    await _localDb.init();

    if (!await _hasConnection()) {
      return const SyncResult(
        synced: 0,
        failed: 0,
        skippedOffline: true,
      );
    }

    final pendencias = await _localDb.listarPendencias();
    var synced = 0;
    var failed = 0;
    String? failedAction;
    String? failedError;

    for (final item in pendencias) {
      final id = item['id'] as int;
      final action = item['action'] as String;
      final payload = jsonDecode(item['payload_json'] as String)
          as Map<String, dynamic>;
      final photoPath = item['photo_path'] as String?;

      try {
        final resolvedPayload = await _resolvePayload(
          payload: payload,
          photoPath: photoPath,
          tokenAtual: tokenAtual,
        );
        await _api.executarAcaoMobile(action: action, payload: resolvedPayload);
        await _localDb.marcarSincronizado(id);
        await _camera.apagarFotoLocal(photoPath);
        synced++;
      } catch (error) {
        final cleanError = _cleanError(error);
        if (_isPendenciaDeChamadoRemovido(error)) {
          await _localDb.marcarSincronizado(id);
          await _camera.apagarFotoLocal(photoPath);
          synced++;
          continue;
        }

        await _localDb.marcarFalha(
          id,
          cleanError,
        );
        failed++;
        failedAction = action;
        failedError = cleanError;
        break;
      }
    }

    await _localDb.removerSincronizados();
    return SyncResult(
      synced: synced,
      failed: failed,
      failedAction: failedAction,
      failedError: failedError,
    );
  }

  Stream<ConnectivityResult> connectivityChanges() {
    return _connectivity.onConnectivityChanged
        .map((items) => items.isEmpty ? ConnectivityResult.none : items.first);
  }

  Future<bool> _hasConnection() async {
    final connectivity = await _connectivity.checkConnectivity();
    return connectivity.any((item) => item != ConnectivityResult.none);
  }

  Future<Map<String, dynamic>> _resolvePayload({
    required Map<String, dynamic> payload,
    required String? photoPath,
    String? tokenAtual,
  }) async {
    final resolvedToken = tokenAtual?.trim();
    final payloadWithCurrentToken =
        resolvedToken == null || resolvedToken.isEmpty
            ? payload
            : {
                ...payload,
                'token': resolvedToken,
              };

    if (photoPath == null || photoPath.trim().isEmpty) {
      return payloadWithCurrentToken;
    }

    final file = File(photoPath);
    if (!await file.exists()) {
      throw Exception('Foto pendente nao encontrada no aparelho.');
    }

    return {
      ...payloadWithCurrentToken,
      'file_name': file.uri.pathSegments.isEmpty
          ? 'foto.jpg'
          : file.uri.pathSegments.last,
      'mime_type': 'image/jpeg',
      'content_base64': base64Encode(await file.readAsBytes()),
    };
  }

  String _cleanError(Object error) {
    if (error is ApiException) {
      return error.message;
    }

    return error.toString().replaceFirst('Exception: ', '');
  }

  bool _isPendenciaDeChamadoRemovido(Object error) {
    return error is ApiException && error.code == 'CHAMADO_NAO_ENCONTRADO';
  }
}

class SyncResult {
  final int synced;
  final int failed;
  final bool skippedOffline;
  final String? failedAction;
  final String? failedError;

  const SyncResult({
    required this.synced,
    required this.failed,
    this.skippedOffline = false,
    this.failedAction,
    this.failedError,
  });
}
