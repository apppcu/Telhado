import 'package:flutter/material.dart';
import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../services/camera_service.dart';
import '../services/local_db_service.dart';
import '../services/location_service.dart';
import '../services/sync_service.dart';

class ChamadoDetalhePage extends StatefulWidget {
  final Map<String, dynamic> session;
  final Map<String, dynamic> chamado;

  const ChamadoDetalhePage({
    super.key,
    required this.session,
    required this.chamado,
  });

  @override
  State<ChamadoDetalhePage> createState() => _ChamadoDetalhePageState();
}

class _ChamadoDetalhePageState extends State<ChamadoDetalhePage> {
  final _vistoriaFormKey = GlobalKey<FormState>();
  final _observacaoTecnicaController = TextEditingController();
  final _materiaisController = TextEditingController();
  final _execucaoFormKey = GlobalKey<FormState>();
  final _servicoExecutadoController = TextEditingController();
  final _observacaoFinalController = TextEditingController();
  final _localDb = LocalDbService.instance;
  final _camera = CameraService();
  final _location = const LocationService();
  final _sync = SyncService();
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;

  late Map<String, dynamic> _chamado;
  bool _starting = false;
  bool _savingVistoria = false;
  bool _startingRepair = false;
  bool _finishingRepair = false;
  bool _reopeningInspection = false;
  bool _novaVistoriaFormAberta = false;
  bool _execucaoConcluida = false;
  bool _takingBeforePhoto = false;
  bool _takingAfterPhoto = false;
  String _message = '';
  String _syncMessage = '';

  @override
  void initState() {
    super.initState();
    _chamado = Map<String, dynamic>.from(widget.chamado);
    _execucaoConcluida = _execucaoJaRegistrada(_chamado);
    _servicoExecutadoController.text =
        (_chamado['servico_executado'] ?? '').toString();
    _observacaoFinalController.text =
        (_chamado['observacao_final'] ?? '').toString();
    _connectivitySubscription = _sync.connectivityChanges().listen((status) {
      if (status != ConnectivityResult.none) {
        _sincronizarPendenciasDaTela();
      }
    });
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _observacaoTecnicaController.dispose();
    _materiaisController.dispose();
    _servicoExecutadoController.dispose();
    _observacaoFinalController.dispose();
    super.dispose();
  }

  Future<void> _sincronizarPendenciasDaTela() async {
    final result = await _sync.sincronizarPendencias(tokenAtual: _sessionToken());
    if (!mounted || result.skippedOffline) {
      return;
    }

    if (result.synced > 0) {
      setState(() {
        _chamado = {
          ..._chamado,
          'sync_status': 'SINCRONIZADO',
        };
        _syncMessage = 'Pendencias sincronizadas.';
      });
    } else if (result.failed > 0) {
      setState(() {
        _syncMessage = _syncFailureMessage(
          result,
          'Ainda ha pendencias para sincronizar.',
        );
      });
    }
  }

  Future<void> _executarAcaoComSync({
    required String action,
    required Map<String, dynamic> payload,
    required Map<String, dynamic> localChamado,
    String? photoPath,
    required ValueSetter<bool> setLoading,
    VoidCallback? onLocalSaved,
    required String pendingMessage,
    required String offlineMessage,
    required String failureFallback,
    required String syncedMessage,
    required String snackMessage,
    Map<String, dynamic> Function(Map<String, dynamic> chamado)? syncedUpdate,
  }) async {
    setState(() {
      setLoading(true);
      _message = '';
      _syncMessage = '';
    });

    try {
      await _localDb.salvarChamadoCache(localChamado);
      await _sync.enfileirar(
        action: action,
        payload: payload,
        photoPath: photoPath,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = localChamado;
        onLocalSaved?.call();
        _syncMessage = pendingMessage;
      });

      final result = await _sync.sincronizarPendencias(tokenAtual: _sessionToken());
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = offlineMessage;
        } else if (result.failed > 0) {
          _syncMessage = _syncFailureMessage(result, failureFallback);
        } else if (result.synced > 0) {
          _chamado = syncedUpdate?.call(_chamado) ??
              {
                ..._chamado,
                'sync_status': 'SINCRONIZADO',
              };
          _syncMessage = syncedMessage;
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(snackMessage)),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          setLoading(false);
        });
      }
    }
  }

  Future<void> _iniciarVistoria() async {
    final now = DateTime.now().toIso8601String();
    final payload = await _withLocation({
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
    });
    final localChamado = {
      ..._chamado,
      'status': 'EM_ANALISE',
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    await _executarAcaoComSync(
      action: 'iniciar_vistoria_tecnico_mobile',
      payload: payload,
      localChamado: localChamado,
      setLoading: (value) => _starting = value,
      onLocalSaved: () {
        _observacaoTecnicaController.clear();
        _materiaisController.clear();
      },
      pendingMessage:
          'Inicio da vistoria salvo no aparelho. Sincronizacao pendente.',
      offlineMessage:
          'Sem internet. O inicio da vistoria sera enviado automaticamente depois.',
      failureFallback:
          'Inicio da vistoria salvo no aparelho. Envio pendente para tentar novamente.',
      syncedMessage: 'Inicio da vistoria sincronizado com sucesso.',
      snackMessage: 'Vistoria iniciada.',
    );
  }

  Future<void> _iniciarReparo() async {
    final now = DateTime.now().toIso8601String();
    final payload = await _withLocation({
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
    });
    final localChamado = {
      ..._chamado,
      'status': 'EM_EXECUCAO',
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    await _executarAcaoComSync(
      action: 'iniciar_reparo_tecnico_mobile',
      payload: payload,
      localChamado: localChamado,
      setLoading: (value) => _startingRepair = value,
      pendingMessage:
          'Inicio do reparo salvo no aparelho. Sincronizacao pendente.',
      offlineMessage:
          'Sem internet. O inicio do reparo sera enviado automaticamente depois.',
      failureFallback:
          'Inicio do reparo salvo no aparelho. Envio pendente para tentar novamente.',
      syncedMessage: 'Inicio do reparo sincronizado com sucesso.',
      snackMessage: 'Reparo iniciado.',
    );
  }

  Future<void> _concluirReparo() async {
    if (!_fotoFinalRegistrada(_chamado)) {
      setState(() {
        _message = 'Registre a foto final antes de encerrar o servico.';
      });
      return;
    }

    final servicoExecutado = _servicoExecutadoController.text.trim().isNotEmpty
        ? _servicoExecutadoController.text.trim()
        : (_chamado['servico_executado'] ?? '').toString().trim();
    final observacaoFinal = _observacaoFinalController.text.trim().isNotEmpty
        ? _observacaoFinalController.text.trim()
        : (_chamado['observacao_final'] ?? '').toString().trim();

    final now = DateTime.now().toIso8601String();
    final observacaoAtual = (_chamado['observacao'] ?? '').toString().trim();
    final resumoConclusao = _buildResumoConclusao(
      servicoExecutado: servicoExecutado,
      observacaoFinal: observacaoFinal,
    );
    final payload = await _withLocation({
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
      'servico_executado': servicoExecutado,
      'observacao_final': observacaoFinal,
    });
    final localChamado = {
      ..._chamado,
      'status': 'CONCLUIDO',
      'observacao': _appendObservacao(observacaoAtual, resumoConclusao),
      'servico_executado': servicoExecutado,
      'observacao_final': observacaoFinal,
      'data_fechamento': now,
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    await _executarAcaoComSync(
      action: 'concluir_reparo_tecnico_mobile',
      payload: payload,
      localChamado: localChamado,
      setLoading: (value) => _finishingRepair = value,
      onLocalSaved: () {
        _execucaoConcluida = true;
        _servicoExecutadoController.clear();
        _observacaoFinalController.clear();
      },
      pendingMessage: 'Conclusao salva no aparelho. Sincronizacao pendente.',
      offlineMessage:
          'Sem internet. A conclusao sera enviada automaticamente depois.',
      failureFallback:
          'Conclusao salva no aparelho. Envio pendente para tentar novamente.',
      syncedMessage: 'Conclusao sincronizada com sucesso.',
      snackMessage: 'Reparo concluido.',
    );
  }

  Future<void> _reabrirVistoria(String justificativa) async {
    if (justificativa.isEmpty) {
      setState(() {
        _message = 'Explique por que uma nova vistoria e necessaria.';
      });
      return;
    }

    final now = DateTime.now().toIso8601String();
    final observacaoAtual = (_chamado['observacao'] ?? '').toString().trim();
    final novaObservacao = _appendObservacao(
      observacaoAtual,
      'Nova vistoria: $justificativa',
    );
    final payload = await _withLocation({
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
      'justificativa': justificativa,
    });
    final localChamado = {
      ..._chamado,
      'status': 'EM_ANALISE',
      'observacao': novaObservacao,
      'sync_status': 'PENDENTE',
      'updated_at': now,
      'nova_vistoria_pendente': true,
      'nova_vistoria_justificativa': justificativa,
    };

    await _executarAcaoComSync(
      action: 'reabrir_vistoria_tecnico_mobile',
      payload: payload,
      localChamado: localChamado,
      setLoading: (value) => _reopeningInspection = value,
      onLocalSaved: () {
        _novaVistoriaFormAberta = true;
        _execucaoConcluida = false;
      },
      pendingMessage: 'Justificativa salva. Informe materiais da nova vistoria.',
      offlineMessage:
          'Sem internet. A justificativa sera enviada automaticamente depois.',
      failureFallback:
          'Justificativa salva no aparelho. Envio pendente para tentar novamente.',
      syncedMessage:
          'Justificativa sincronizada. Informe materiais da nova vistoria.',
      snackMessage: 'Justificativa registrada.',
    );
  }

  Future<void> _showNovaVistoriaDialog() async {
    final formKey = GlobalKey<FormState>();
    var justificativaText = '';

    final justificativa = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Abrir nova vistoria'),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          content: Form(
            key: formKey,
            child: TextFormField(
              autofocus: true,
              minLines: 3,
              maxLines: 5,
              textInputAction: TextInputAction.newline,
              onChanged: (value) {
                justificativaText = value;
              },
              decoration: const InputDecoration(
                labelText: 'Justificativa',
                prefixIcon: Icon(Icons.edit_note),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Explique por que uma nova vistoria e necessaria.';
                }
                return null;
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  Navigator.of(context).pop(justificativaText.trim());
                }
              },
              child: const Text('Abrir'),
            ),
          ],
        );
      },
    );

    if (justificativa != null && justificativa.isNotEmpty) {
      await _reabrirVistoria(justificativa);
    }
  }

  Future<void> _salvarVistoria() async {
    if (!_vistoriaFormKey.currentState!.validate()) {
      return;
    }

    final novaVistoriaPendente = _novaVistoriaPendente(_chamado);
    if (!novaVistoriaPendente && !_fotoAntesRegistrada(_chamado)) {
      setState(() {
        _message = 'Tire a foto antes para salvar a vistoria.';
      });
      return;
    }

    final observacaoTecnica = novaVistoriaPendente
        ? (_chamado['nova_vistoria_justificativa'] ?? '').toString().trim()
        : _observacaoTecnicaController.text.trim();
    final materiais = _materiaisController.text.trim();
    final now = DateTime.now().toIso8601String();
    const nextStatus = 'EM_ANALISE';
    final resumo = _buildResumoVistoria(
      observacaoTecnica: observacaoTecnica,
      materiais: materiais,
    );
    final observacaoAtual = (_chamado['observacao'] ?? '').toString();
    final payload = await _withLocation({
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
      'observacao_tecnica': observacaoTecnica,
      'materiais': materiais,
      'ferramentas': '',
      'resolver_na_hora': false,
    });
    final localChamado = {
      ..._chamado,
      'status': nextStatus,
      'observacao': novaVistoriaPendente
          ? _appendObservacao(observacaoAtual, resumo)
          : resumo,
      'observacao_tecnica': observacaoTecnica,
      'materiais': materiais,
      'ferramentas': '',
      'resolver_na_hora': false,
      'forcar_nova_vistoria': false,
      'nova_vistoria_pendente': false,
      'nova_vistoria_justificativa': '',
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    await _executarAcaoComSync(
      action: 'salvar_vistoria_tecnico_mobile',
      payload: payload,
      localChamado: localChamado,
      setLoading: (value) => _savingVistoria = value,
      onLocalSaved: () {
        _observacaoTecnicaController.clear();
        _materiaisController.clear();
        _novaVistoriaFormAberta = false;
        _execucaoConcluida = false;
      },
      pendingMessage: 'Vistoria salva no aparelho. Sincronizacao pendente.',
      offlineMessage:
          'Sem internet. A vistoria sera enviada automaticamente depois.',
      failureFallback:
          'Vistoria salva no aparelho. Envio pendente para tentar novamente.',
      syncedMessage: 'Vistoria sincronizada com sucesso.',
      snackMessage: 'Vistoria salva.',
    );
  }

  Future<void> _tirarFotoAntes() async {
    setState(() {
      _takingBeforePhoto = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      final chamadoId = (_chamado['id'] ?? '').toString();
      final photoPath = await _camera.tirarFoto(
        chamadoId: chamadoId,
        tipo: 'VISTORIA_ANTES',
      );

      if (photoPath == null) {
        return;
      }

      final updated = {
        ..._chamado,
        'foto_antes_path': photoPath,
        'foto_antes_sync_status': 'PENDENTE',
        'sync_status': 'PENDENTE',
        'updated_at': DateTime.now().toIso8601String(),
      };

      await _executarAcaoComSync(
        action: 'upload_foto',
        payload: await _withLocation({
          'token': (widget.session['token'] ?? '').toString(),
          'chamado_id': chamadoId,
          'tipo': 'VISTORIA_ANTES',
        }),
        localChamado: updated,
        photoPath: photoPath,
        setLoading: (value) => _takingBeforePhoto = value,
        pendingMessage: 'Foto antes salva no aparelho. Sincronizacao pendente.',
        offlineMessage:
            'Sem internet. A foto antes sera enviada automaticamente depois.',
        failureFallback:
            'Foto antes salva no aparelho. Envio pendente para tentar novamente.',
        syncedMessage: 'Foto antes sincronizada com sucesso.',
        snackMessage: 'Foto antes registrada.',
        syncedUpdate: (chamado) => {
          ...chamado,
          'foto_antes_sync_status': 'SINCRONIZADO',
          'sync_status': 'SINCRONIZADO',
        },
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _takingBeforePhoto = false;
        });
      }
    }
  }

  Future<void> _tirarFotoFinal() async {
    setState(() {
      _takingAfterPhoto = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      final chamadoId = (_chamado['id'] ?? '').toString();
      final photoPath = await _camera.tirarFoto(
        chamadoId: chamadoId,
        tipo: 'CONCLUSAO',
      );

      if (photoPath == null) {
        return;
      }

      final updated = {
        ..._chamado,
        'foto_final_path': photoPath,
        'foto_final_sync_status': 'PENDENTE',
        'sync_status': 'PENDENTE',
        'updated_at': DateTime.now().toIso8601String(),
      };

      await _localDb.salvarChamadoCache(updated);
      await _sync.enfileirar(
        action: 'upload_foto',
        payload: await _withLocation({
          'token': (widget.session['token'] ?? '').toString(),
          'chamado_id': chamadoId,
          'tipo': 'CONCLUSAO',
        }),
        photoPath: photoPath,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = updated;
        _syncMessage =
            'Foto final salva no aparelho. Ela sera enviada ao encerrar o servico.';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto final registrada.')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _takingAfterPhoto = false;
        });
      }
    }
  }

  String _buildResumoVistoria({
    required String observacaoTecnica,
    required String materiais,
  }) {
    final parts = <String>[];

    if (observacaoTecnica.isNotEmpty) {
      parts.add('Vistoria tecnica: $observacaoTecnica');
    }

    if (materiais.isNotEmpty) {
      parts.add('Materiais necessarios: $materiais');
    }

    if (parts.isEmpty) {
      parts.add('Vistoria registrada pelo aplicativo mobile.');
    }
    return parts.join('\n');
  }

  String _buildResumoConclusao({
    required String servicoExecutado,
    required String observacaoFinal,
  }) {
    final parts = <String>[];

    if (servicoExecutado.isNotEmpty) {
      parts.add('Servico executado: $servicoExecutado');
    }

    if (observacaoFinal.isNotEmpty) {
      parts.add('Observacao final: $observacaoFinal');
    }

    if (parts.isEmpty) {
      parts.add('Servico encerrado pelo aplicativo mobile.');
    }

    return parts.join('\n');
  }

  String _appendObservacao(String atual, String novoBloco) {
    final current = atual.trim();
    final next = novoBloco.trim();

    if (current.isEmpty) {
      return next;
    }

    if (next.isEmpty) {
      return current;
    }

    return '$current\n\n$next';
  }

  Future<Map<String, dynamic>> _withLocation(
    Map<String, dynamic> payload,
  ) async {
    return {
      ...payload,
      'localizacao': await _location.getCurrentLocationPayload(),
    };
  }

  String _syncFailureMessage(SyncResult result, String fallback) {
    final error = result.failedError?.trim();
    if (error == null || error.isEmpty) {
      return fallback;
    }

    final action = _syncActionLabel(result.failedAction);
    return '$fallback\nFalha em $action: $error';
  }

  String _syncActionLabel(String? action) {
    switch (action) {
      case 'upload_foto':
        return 'envio de foto';
      case 'concluir_reparo_tecnico_mobile':
        return 'encerramento do servico';
      case 'iniciar_vistoria_tecnico_mobile':
        return 'inicio da vistoria';
      case 'salvar_vistoria_tecnico_mobile':
        return 'vistoria';
      case 'iniciar_reparo_tecnico_mobile':
        return 'inicio do reparo';
      case 'reabrir_vistoria_tecnico_mobile':
        return 'nova vistoria';
      default:
        return action == null || action.trim().isEmpty
            ? 'sincronizacao'
            : action;
    }
  }

  String _sessionToken() {
    return (widget.session['token'] ?? '').toString();
  }

  @override
  Widget build(BuildContext context) {
    final status = _statusAtual(_chamado);
    final canStart = status == 'ENCAMINHADO';
    final alreadyStarted = status == 'EM_ANALISE';
    final inspectionSaved = _vistoriaRegistrada(_chamado);
    final novaVistoriaPendente = _novaVistoriaPendente(_chamado);
    final canSaveInspection =
        status == 'EM_ANALISE' && (!inspectionSaved || _novaVistoriaFormAberta);
    final showRepairPending = status == 'EM_ANALISE' && inspectionSaved;
    final repairStarted = status == 'EM_EXECUCAO';
    final showServiceActions = showRepairPending || repairStarted;
    final finished = status == 'CONCLUIDO';

    return Scaffold(
      appBar: AppBar(
        title: Text((_chamado['numero'] ?? 'Chamado').toString()),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final horizontalPadding = constraints.maxWidth < 380 ? 16.0 : 24.0;

          return ListView(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              16,
              horizontalPadding,
              24,
            ),
            children: [
              _HeaderCard(chamado: _chamado),
              const SizedBox(height: 16),
              _InfoCard(chamado: _chamado),
              if (canSaveInspection) ...[
                const SizedBox(height: 16),
                _VistoriaFormCard(
                  formKey: _vistoriaFormKey,
                  observacaoTecnicaController: _observacaoTecnicaController,
                  materiaisController: _materiaisController,
                  saving: _savingVistoria,
                  takingBeforePhoto: _takingBeforePhoto,
                  isNovaVistoria: novaVistoriaPendente,
                  hasBeforePhoto:
                      (_chamado['foto_antes_path'] ?? '').toString().isNotEmpty ||
                          (_chamado['foto_antes_sync_status'] ?? '') ==
                              'SINCRONIZADO',
                  onTakeBeforePhoto:
                      _takingBeforePhoto ||
                              (_chamado['foto_antes_path'] ?? '')
                                  .toString()
                                  .isNotEmpty ||
                              (_chamado['foto_antes_sync_status'] ?? '') ==
                                  'SINCRONIZADO'
                          ? null
                          : _tirarFotoAntes,
                  onSubmit: _savingVistoria ? null : _salvarVistoria,
                ),
                const SizedBox(height: 12),
              ],
              if (showServiceActions) ...[
                const SizedBox(height: 16),
                _ServicoAcoesCard(
                  starting: _startingRepair,
                  newInspectionLoading: _reopeningInspection,
                  takingFinalPhoto: _takingAfterPhoto,
                  closingService: _finishingRepair,
                  onNewInspection: _showNovaVistoriaDialog,
                  onFinishRepair:
                      _startingRepair ? null : _abrirExecucaoDoReparo,
                  onFinalPhoto:
                      _takingAfterPhoto ? null : _tirarFotoFinalComValidacao,
                  onCloseService:
                      _finishingRepair ? null : _encerrarServicoComValidacao,
                ),
                const SizedBox(height: 12),
              ],
              if (finished) ...[
                const SizedBox(height: 16),
                const _FinishedCard(),
              ],
              if (_message.isNotEmpty) ...[
                const SizedBox(height: 12),
                _InlineMessage(message: _message, isError: true),
              ],
              if (_syncMessage.isNotEmpty) ...[
                const SizedBox(height: 12),
                _InlineMessage(message: _syncMessage),
              ],
              const SizedBox(height: 20),
              if (canStart || (alreadyStarted && !inspectionSaved))
                FilledButton.icon(
                  onPressed: canStart && !_starting ? _iniciarVistoria : null,
                  icon: _starting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.fact_check),
                  label: Text(
                    alreadyStarted
                        ? 'Vistoria em andamento'
                        : 'Iniciar vistoria',
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _marcarExecucaoConcluida() async {
    if (!_execucaoFormKey.currentState!.validate()) {
      return;
    }

    final updated = {
      ..._chamado,
      'servico_executado': _servicoExecutadoController.text.trim(),
      'observacao_final': _observacaoFinalController.text.trim(),
      'execucao_concluida': true,
      'updated_at': DateTime.now().toIso8601String(),
    };

    await _localDb.salvarChamadoCache(updated);

    if (!mounted) {
      return;
    }

    setState(() {
      _chamado = updated;
      _execucaoConcluida = true;
      _message = '';
      _syncMessage =
          'Execucao registrada. Tire a foto final e encerre o servico.';
    });
  }

  Future<void> _abrirExecucaoDoReparo() async {
    if (_statusAtual(_chamado) == 'EM_ANALISE') {
      await _iniciarReparo();
      if (!mounted || _statusAtual(_chamado) != 'EM_EXECUCAO') {
        return;
      }
    }

    await _showExecucaoDialog();
  }

  Future<void> _tirarFotoFinalComValidacao() async {
    if (!_execucaoConcluida) {
      _avisarConcluirReparoAntesDaFoto();
      return;
    }

    await _tirarFotoFinal();
  }

  Future<void> _encerrarServicoComValidacao() async {
    if (!_execucaoConcluida) {
      _avisarConcluirReparoAntesDaFoto();
      return;
    }

    if (!_fotoFinalRegistrada(_chamado)) {
      _avisarFotoAntesDeEncerrar();
      return;
    }

    await _concluirReparo();
  }

  Future<void> _showExecucaoDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Concluir Reparo'),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          content: Form(
            key: _execucaoFormKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: _servicoExecutadoController,
                    minLines: 3,
                    maxLines: 6,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      labelText: 'Servico executado',
                      prefixIcon: Icon(Icons.build_circle_outlined),
                    ),
                ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _observacaoFinalController,
                    minLines: 2,
                    maxLines: 5,
                    textInputAction: TextInputAction.newline,
                    decoration: const InputDecoration(
                      labelText: 'Observacao final',
                      prefixIcon: Icon(Icons.notes),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () {
                if (_execucaoFormKey.currentState!.validate()) {
                  Navigator.of(context).pop(true);
                }
              },
              child: const Text('Concluir'),
            ),
          ],
        );
      },
    );

    if (result == true) {
      await _marcarExecucaoConcluida();
    }
  }

  void _avisarConcluirReparoAntesDaFoto() {
    setState(() {
      _message = 'Conclua o reparo antes de tirar a foto final.';
    });
  }

  void _avisarFotoAntesDeEncerrar() {
    setState(() {
      _message = 'Tire a foto final antes de encerrar o servico.';
    });
  }

  bool _execucaoJaRegistrada(Map<String, dynamic> chamado) {
    if (chamado['execucao_concluida'] == true) {
      return true;
    }

    return (chamado['servico_executado'] ?? '').toString().trim().isNotEmpty;
  }

  bool _fotoFinalRegistrada(Map<String, dynamic> chamado) {
    return (chamado['foto_final_path'] ?? '').toString().isNotEmpty ||
        (chamado['foto_final_sync_status'] ?? '') == 'SINCRONIZADO';
  }

  bool _fotoAntesRegistrada(Map<String, dynamic> chamado) {
    return (chamado['foto_antes_path'] ?? '').toString().isNotEmpty ||
        (chamado['foto_antes_sync_status'] ?? '') == 'SINCRONIZADO';
  }

  String _statusAtual(Map<String, dynamic> chamado) {
    return (chamado['status'] ?? '').toString().trim().toUpperCase();
  }

  bool _vistoriaRegistrada(Map<String, dynamic> chamado) {
    final observacaoTecnica =
        (chamado['observacao_tecnica'] ?? '').toString().trim();
    final observacao = (chamado['observacao'] ?? '').toString().toLowerCase();

    return observacaoTecnica.isNotEmpty ||
        observacao.contains('vistoria tecnica:') ||
        observacao.contains('vistoria registrada pelo aplicativo mobile.');
  }

  bool _novaVistoriaPendente(Map<String, dynamic> chamado) {
    if (chamado['nova_vistoria_pendente'] == true) {
      return true;
    }

    final observacao = (chamado['observacao'] ?? '').toString().toLowerCase();
    final lastNovaVistoria = observacao.lastIndexOf('nova vistoria:');
    if (lastNovaVistoria < 0) {
      return false;
    }

    final lastVistoriaTecnica = observacao.lastIndexOf('vistoria tecnica:');
    return lastNovaVistoria > lastVistoriaTecnica;
  }
}

class _VistoriaFormCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController observacaoTecnicaController;
  final TextEditingController materiaisController;
  final bool saving;
  final bool takingBeforePhoto;
  final bool isNovaVistoria;
  final bool hasBeforePhoto;
  final VoidCallback? onTakeBeforePhoto;
  final VoidCallback? onSubmit;

  const _VistoriaFormCard({
    required this.formKey,
    required this.observacaoTecnicaController,
    required this.materiaisController,
    required this.saving,
    required this.takingBeforePhoto,
    required this.isNovaVistoria,
    required this.hasBeforePhoto,
    required this.onTakeBeforePhoto,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                isNovaVistoria ? 'Nova Vistoria' : 'Vistoria',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 12),
              if (!isNovaVistoria) ...[
                TextFormField(
                  controller: observacaoTecnicaController,
                  minLines: 3,
                  maxLines: 6,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    labelText: 'Observacao tecnica',
                    prefixIcon: Icon(Icons.notes),
                  ),
                ),
                const SizedBox(height: 14),
              ],
              TextFormField(
                controller: materiaisController,
                minLines: 2,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Materiais necessarios',
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
              ),
              const SizedBox(height: 14),
              if (!isNovaVistoria) ...[
                OutlinedButton.icon(
                  onPressed: hasBeforePhoto ? null : onTakeBeforePhoto,
                  icon: takingBeforePhoto
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          hasBeforePhoto
                              ? Icons.check_circle
                              : Icons.photo_camera,
                        ),
                  label: Text(
                    hasBeforePhoto ? 'Foto antes registrada' : 'Foto antes',
                  ),
                ),
                const SizedBox(height: 12),
              ],
              FilledButton.icon(
                onPressed: onSubmit,
                icon: saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save),
                label: const Text('Salvar vistoria'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServicoAcoesCard extends StatelessWidget {
  final bool starting;
  final bool newInspectionLoading;
  final bool takingFinalPhoto;
  final bool closingService;
  final VoidCallback? onNewInspection;
  final VoidCallback? onFinishRepair;
  final VoidCallback? onFinalPhoto;
  final VoidCallback? onCloseService;

  const _ServicoAcoesCard({
    required this.starting,
    required this.newInspectionLoading,
    required this.takingFinalPhoto,
    required this.closingService,
    required this.onNewInspection,
    required this.onFinishRepair,
    required this.onFinalPhoto,
    required this.onCloseService,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            OutlinedButton.icon(
              onPressed: newInspectionLoading ? null : onNewInspection,
              icon: newInspectionLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.assignment_return),
              label: const Text('Nova Vistoria'),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: onFinishRepair,
              icon: starting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.build_circle),
              label: const Text('Concluir Reparo'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: onFinalPhoto,
              icon: takingFinalPhoto
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.photo_camera),
              label: const Text('Foto Final'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: onCloseService,
              style: OutlinedButton.styleFrom(
                foregroundColor: colorScheme.primary,
                side: BorderSide(color: colorScheme.primary, width: 1.2),
              ),
              icon: closingService
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check_circle),
              label: const Text('Encerrar Servico'),
            ),
          ],
        ),
      ),
    );
  }
}

class _FinishedCard extends StatelessWidget {
  const _FinishedCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Icon(
              Icons.verified,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Chamado concluido',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineMessage extends StatelessWidget {
  final String message;
  final bool isError;

  const _InlineMessage({
    required this.message,
    this.isError = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final background =
        isError ? colorScheme.errorContainer : const Color(0xFFE7F3EE);
    final foreground =
        isError ? colorScheme.onErrorContainer : const Color(0xFF0D5F4D);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.sync,
            color: foreground,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: foreground, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;

  const _StatusBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    final colors = _statusColors(context, label);

    return Chip(
      label: Text(label),
      visualDensity: VisualDensity.compact,
      backgroundColor: colors.background,
      labelStyle: TextStyle(
        color: colors.foreground,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

class _BadgeColors {
  final Color background;
  final Color foreground;

  const _BadgeColors({
    required this.background,
    required this.foreground,
  });
}

_BadgeColors _statusColors(BuildContext context, String label) {
  final colorScheme = Theme.of(context).colorScheme;

  switch (label.trim().toUpperCase()) {
    case 'EM_EXECUCAO':
      return const _BadgeColors(
        background: Color(0xFFFFE8B7),
        foreground: Color(0xFF5A3A00),
      );
    case 'EM_ANALISE':
      return const _BadgeColors(
        background: Color(0xFFE4EDFF),
        foreground: Color(0xFF16427D),
      );
    case 'CONCLUIDO':
      return const _BadgeColors(
        background: Color(0xFFDFF4E9),
        foreground: Color(0xFF0A5C48),
      );
    default:
      return _BadgeColors(
        background: colorScheme.surfaceContainerHighest,
        foreground: colorScheme.onSurfaceVariant,
      );
  }
}

class _HeaderCard extends StatelessWidget {
  final Map<String, dynamic> chamado;

  const _HeaderCard({required this.chamado});

  @override
  Widget build(BuildContext context) {
    final status = (chamado['status'] ?? '-').toString();
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    (chamado['numero'] ?? '-').toString(),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: colorScheme.onSurface,
                        ),
                  ),
                ),
                _StatusBadge(label: status),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              (chamado['descricao'] ?? '').toString(),
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    height: 1.35,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final Map<String, dynamic> chamado;

  const _InfoCard({required this.chamado});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            _DetailLine(label: 'Prioridade', value: chamado['prioridade']),
            _DetailLine(label: 'Categoria', value: chamado['categoria']),
            _DetailLine(label: 'Centro', value: chamado['centro_sigla']),
            _DetailLine(
              label: 'Local',
              value: chamado['predio_nome'] ?? chamado['predio_id'],
            ),
            _DetailLine(label: 'Abertura', value: chamado['data_abertura']),
            if ((chamado['observacao'] ?? '').toString().isNotEmpty)
              _DetailLine(
                label: 'Observacao',
                value: chamado['observacao'],
                expanded: true,
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  final String label;
  final Object? value;
  final bool expanded;

  const _DetailLine({
    required this.label,
    required this.value,
    this.expanded = false,
  });

  @override
  Widget build(BuildContext context) {
    final resolvedValue = (value ?? '-').toString();
    final labelStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w800,
        );
    final valueStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
          height: 1.35,
        );

    if (expanded || resolvedValue.length > 42) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: labelStyle),
            const SizedBox(height: 4),
            Text(resolvedValue, style: valueStyle),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: labelStyle,
            ),
          ),
          Expanded(child: Text(resolvedValue, style: valueStyle)),
        ],
      ),
    );
  }
}

