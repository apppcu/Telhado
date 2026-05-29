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

  Future<SyncResult> sincronizarPendencias() {
    final active = _activeSync;
    if (active != null) {
      return active;
    }

    final sync = _sincronizarPendencias();
    _activeSync = sync;
    return sync.whenComplete(() {
      if (identical(_activeSync, sync)) {
        _activeSync = null;
      }
    });
  }

  Future<SyncResult> _sincronizarPendencias() async {
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
        );
        await _api.executarAcaoMobile(action: action, payload: resolvedPayload);
        await _localDb.marcarSincronizado(id);
        await _camera.apagarFotoLocal(photoPath);
        synced++;
      } catch (error) {
        await _localDb.marcarFalha(
          id,
          error.toString().replaceFirst('Exception: ', ''),
        );
        failed++;
        break;
      }
    }

    await _localDb.removerSincronizados();
    return SyncResult(synced: synced, failed: failed);
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
  }) async {
    if (photoPath == null || photoPath.trim().isEmpty) {
      return payload;
    }

    final file = File(photoPath);
    if (!await file.exists()) {
      throw Exception('Foto pendente nao encontrada no aparelho.');
    }

    return {
      ...payload,
      'file_name': file.uri.pathSegments.isEmpty
          ? 'foto.jpg'
          : file.uri.pathSegments.last,
      'mime_type': 'image/jpeg',
      'content_base64': base64Encode(await file.readAsBytes()),
    };
  }
}

class SyncResult {
  final int synced;
  final int failed;
  final bool skippedOffline;

  const SyncResult({
    required this.synced,
    required this.failed,
    this.skippedOffline = false,
  });
}
