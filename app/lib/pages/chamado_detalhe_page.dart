import 'package:flutter/material.dart';
import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../services/camera_service.dart';
import '../services/local_db_service.dart';
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
  final _ferramentasController = TextEditingController();
  final _execucaoFormKey = GlobalKey<FormState>();
  final _servicoExecutadoController = TextEditingController();
  final _observacaoFinalController = TextEditingController();
  final _localDb = LocalDbService.instance;
  final _camera = CameraService();
  final _sync = SyncService();
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;

  late Map<String, dynamic> _chamado;
  bool _starting = false;
  bool _savingVistoria = false;
  bool _startingRepair = false;
  bool _finishingRepair = false;
  bool _reopeningInspection = false;
  bool _takingBeforePhoto = false;
  bool _takingAfterPhoto = false;
  bool _resolverNaHora = false;
  String _message = '';
  String _syncMessage = '';

  @override
  void initState() {
    super.initState();
    _chamado = Map<String, dynamic>.from(widget.chamado);
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
    _ferramentasController.dispose();
    _servicoExecutadoController.dispose();
    _observacaoFinalController.dispose();
    super.dispose();
  }

  Future<void> _sincronizarPendenciasDaTela() async {
    final result = await _sync.sincronizarPendencias();
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
        _syncMessage = 'Ainda ha pendencias para sincronizar.';
      });
    }
  }

  Future<void> _iniciarVistoria() async {
    final now = DateTime.now().toIso8601String();
    final payload = {
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
    };
    final localChamado = {
      ..._chamado,
      'status': 'EM_ANALISE',
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    setState(() {
      _starting = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      await _localDb.salvarChamadoCache(localChamado);
      await _sync.enfileirar(
        action: 'iniciar_vistoria_tecnico_mobile',
        payload: payload,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = localChamado;
        if (_resolverNaHora) {
          _observacaoTecnicaController.clear();
          _materiaisController.clear();
          _ferramentasController.clear();
          _resolverNaHora = false;
        }
        _syncMessage = 'Inicio da vistoria salvo no aparelho. Sincronizacao pendente.';
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. O inicio da vistoria sera enviado automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Inicio da vistoria salvo no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Inicio da vistoria sincronizado com sucesso.';
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vistoria iniciada.')),
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
          _starting = false;
        });
      }
    }
  }

  Future<void> _iniciarReparo() async {
    final now = DateTime.now().toIso8601String();
    final payload = {
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
    };
    final localChamado = {
      ..._chamado,
      'status': 'EM_EXECUCAO',
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    setState(() {
      _startingRepair = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      await _localDb.salvarChamadoCache(localChamado);
      await _sync.enfileirar(
        action: 'iniciar_reparo_tecnico_mobile',
        payload: payload,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = localChamado;
        _syncMessage = 'Inicio do reparo salvo no aparelho. Sincronizacao pendente.';
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. O inicio do reparo sera enviado automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Inicio do reparo salvo no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Inicio do reparo sincronizado com sucesso.';
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reparo iniciado.')),
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
          _startingRepair = false;
        });
      }
    }
  }

  Future<void> _concluirReparo() async {
    if (!_execucaoFormKey.currentState!.validate()) {
      return;
    }

    final servicoExecutado = _servicoExecutadoController.text.trim();
    final observacaoFinal = _observacaoFinalController.text.trim();
    final now = DateTime.now().toIso8601String();
    final observacaoAtual = (_chamado['observacao'] ?? '').toString().trim();
    final resumoConclusao = _buildResumoConclusao(
      servicoExecutado: servicoExecutado,
      observacaoFinal: observacaoFinal,
    );
    final payload = {
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
      'servico_executado': servicoExecutado,
      'observacao_final': observacaoFinal,
    };
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

    setState(() {
      _finishingRepair = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      await _localDb.salvarChamadoCache(localChamado);
      await _sync.enfileirar(
        action: 'concluir_reparo_tecnico_mobile',
        payload: payload,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = localChamado;
        _servicoExecutadoController.clear();
        _observacaoFinalController.clear();
        _syncMessage = 'Conclusao salva no aparelho. Sincronizacao pendente.';
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. A conclusao sera enviada automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Conclusao salva no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Conclusao sincronizada com sucesso.';
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reparo concluido.')),
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
          _finishingRepair = false;
        });
      }
    }
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
    final payload = {
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
      'justificativa': justificativa,
    };
    final localChamado = {
      ..._chamado,
      'status': 'EM_ANALISE',
      'observacao': novaObservacao,
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    setState(() {
      _reopeningInspection = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      await _localDb.salvarChamadoCache(localChamado);
      await _sync.enfileirar(
        action: 'reabrir_vistoria_tecnico_mobile',
        payload: payload,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = localChamado;
        _syncMessage = 'Nova vistoria salva no aparelho. Sincronizacao pendente.';
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. A nova vistoria sera enviada automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Nova vistoria salva no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Nova vistoria sincronizada com sucesso.';
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nova vistoria aberta.')),
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
          _reopeningInspection = false;
        });
      }
    }
  }

  Future<void> _showNovaVistoriaDialog() async {
    final controller = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final justificativa = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Abrir nova vistoria'),
          content: Form(
            key: formKey,
            child: TextFormField(
              controller: controller,
              autofocus: true,
              minLines: 3,
              maxLines: 5,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(
                labelText: 'Justificativa',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Explique o novo problema encontrado.';
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
                  Navigator.of(context).pop(controller.text.trim());
                }
              },
              child: const Text('Abrir'),
            ),
          ],
        );
      },
    );

    controller.dispose();

    if (justificativa != null && justificativa.isNotEmpty) {
      await _reabrirVistoria(justificativa);
    }
  }

  Future<void> _salvarVistoria() async {
    if (!_vistoriaFormKey.currentState!.validate()) {
      return;
    }

    final observacaoTecnica = _observacaoTecnicaController.text.trim();
    final materiais = _materiaisController.text.trim();
    final ferramentas = _ferramentasController.text.trim();
    final resolverNaHora = _resolverNaHora;
    final now = DateTime.now().toIso8601String();
    final nextStatus = resolverNaHora ? 'EM_EXECUCAO' : 'EM_ANALISE';
    final resumo = _buildResumoVistoria(
      observacaoTecnica: observacaoTecnica,
      materiais: materiais,
      ferramentas: ferramentas,
      resolverNaHora: resolverNaHora,
    );
    final payload = {
      'token': (widget.session['token'] ?? '').toString(),
      'chamado_id': (_chamado['id'] ?? '').toString(),
      'observacao_tecnica': observacaoTecnica,
      'materiais': materiais,
      'ferramentas': ferramentas,
      'resolver_na_hora': resolverNaHora,
    };
    final localChamado = {
      ..._chamado,
      'status': nextStatus,
      'observacao': resumo,
      'observacao_tecnica': observacaoTecnica,
      'materiais': materiais,
      'ferramentas': ferramentas,
      'resolver_na_hora': resolverNaHora,
      'sync_status': 'PENDENTE',
      'updated_at': now,
    };

    setState(() {
      _savingVistoria = true;
      _message = '';
      _syncMessage = '';
    });

    try {
      await _localDb.salvarChamadoCache(localChamado);
      await _sync.enfileirar(
        action: 'salvar_vistoria_tecnico_mobile',
        payload: payload,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = localChamado;
        _syncMessage = 'Vistoria salva no aparelho. Sincronizacao pendente.';
        _observacaoTecnicaController.clear();
        _materiaisController.clear();
        _ferramentasController.clear();
        _resolverNaHora = false;
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. A vistoria sera enviada automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Vistoria salva no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Vistoria sincronizada com sucesso.';
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vistoria salva.')),
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
          _savingVistoria = false;
        });
      }
    }
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

      await _localDb.salvarChamadoCache(updated);
      await _sync.enfileirar(
        action: 'upload_foto',
        payload: {
          'token': (widget.session['token'] ?? '').toString(),
          'chamado_id': chamadoId,
          'tipo': 'VISTORIA_ANTES',
        },
        photoPath: photoPath,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = updated;
        _syncMessage = 'Foto antes salva no aparelho. Sincronizacao pendente.';
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. A foto antes sera enviada automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Foto antes salva no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'foto_antes_sync_status': 'SINCRONIZADO',
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Foto antes sincronizada com sucesso.';
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Foto antes registrada.')),
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
        payload: {
          'token': (widget.session['token'] ?? '').toString(),
          'chamado_id': chamadoId,
          'tipo': 'CONCLUSAO',
        },
        photoPath: photoPath,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = updated;
        _syncMessage = 'Foto final salva no aparelho. Sincronizacao pendente.';
      });

      final result = await _sync.sincronizarPendencias();
      if (!mounted) {
        return;
      }

      setState(() {
        if (result.skippedOffline) {
          _syncMessage = 'Sem internet. A foto final sera enviada automaticamente depois.';
        } else if (result.failed > 0) {
          _syncMessage = 'Foto final salva no aparelho. Envio pendente para tentar novamente.';
        } else if (result.synced > 0) {
          _chamado = {
            ..._chamado,
            'foto_final_sync_status': 'SINCRONIZADO',
            'sync_status': 'SINCRONIZADO',
          };
          _syncMessage = 'Foto final sincronizada com sucesso.';
        }
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
    required String ferramentas,
    required bool resolverNaHora,
  }) {
    final parts = [
      'Vistoria tecnica: $observacaoTecnica',
    ];

    if (materiais.isNotEmpty) {
      parts.add('Materiais necessarios: $materiais');
    }

    if (ferramentas.isNotEmpty) {
      parts.add('Ferramentas/equipe necessaria: $ferramentas');
    }

    parts.add('Resolver na hora: ${resolverNaHora ? 'SIM' : 'NAO'}');
    return parts.join('\n');
  }

  String _buildResumoConclusao({
    required String servicoExecutado,
    required String observacaoFinal,
  }) {
    final parts = [
      'Servico executado: $servicoExecutado',
    ];

    if (observacaoFinal.isNotEmpty) {
      parts.add('Observacao final: $observacaoFinal');
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

  @override
  Widget build(BuildContext context) {
    final status = (_chamado['status'] ?? '').toString().toUpperCase();
    final canStart = status == 'ENCAMINHADO';
    final alreadyStarted = status == 'EM_ANALISE';
    final canSaveInspection = status == 'EM_ANALISE';
    final repairStarted = status == 'EM_EXECUCAO';
    final finished = status == 'CONCLUIDO';

    return Scaffold(
      appBar: AppBar(
        title: Text((_chamado['numero'] ?? 'Chamado').toString()),
      ),
      body: ListView(
        padding: const EdgeInsets.all(24),
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
              ferramentasController: _ferramentasController,
              resolverNaHora: _resolverNaHora,
              saving: _savingVistoria,
              takingBeforePhoto: _takingBeforePhoto,
              hasBeforePhoto:
                  (_chamado['foto_antes_path'] ?? '').toString().isNotEmpty ||
                      (_chamado['foto_antes_sync_status'] ?? '') ==
                          'SINCRONIZADO',
              onResolverChanged: (value) {
                setState(() {
                  _resolverNaHora = value;
                });
              },
              onTakeBeforePhoto:
                  _takingBeforePhoto ? null : _tirarFotoAntes,
              onSubmit: _savingVistoria ? null : _salvarVistoria,
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _startingRepair ? null : _iniciarReparo,
              icon: _startingRepair
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.build),
              label: const Text('Iniciar reparo'),
            ),
          ],
          if (repairStarted) ...[
            const SizedBox(height: 16),
            _ExecucaoCard(
              formKey: _execucaoFormKey,
              servicoExecutadoController: _servicoExecutadoController,
              observacaoFinalController: _observacaoFinalController,
              finishing: _finishingRepair,
              reopening: _reopeningInspection,
              takingAfterPhoto: _takingAfterPhoto,
              hasAfterPhoto:
                  (_chamado['foto_final_path'] ?? '').toString().isNotEmpty ||
                      (_chamado['foto_final_sync_status'] ?? '') ==
                          'SINCRONIZADO',
              onFinish: _finishingRepair ? null : _concluirReparo,
              onReopen:
                  _reopeningInspection ? null : _showNovaVistoriaDialog,
              onTakeAfterPhoto:
                  _takingAfterPhoto ? null : _tirarFotoFinal,
            ),
          ],
          if (finished) ...[
            const SizedBox(height: 16),
            const _FinishedCard(),
          ],
          if (_message.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              _message,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (_syncMessage.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              _syncMessage,
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ],
          const SizedBox(height: 20),
          if (canStart || alreadyStarted)
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
                alreadyStarted ? 'Vistoria em andamento' : 'Iniciar vistoria',
              ),
            ),
        ],
      ),
    );
  }
}

class _VistoriaFormCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController observacaoTecnicaController;
  final TextEditingController materiaisController;
  final TextEditingController ferramentasController;
  final bool resolverNaHora;
  final bool saving;
  final bool takingBeforePhoto;
  final bool hasBeforePhoto;
  final ValueChanged<bool> onResolverChanged;
  final VoidCallback? onTakeBeforePhoto;
  final VoidCallback? onSubmit;

  const _VistoriaFormCard({
    required this.formKey,
    required this.observacaoTecnicaController,
    required this.materiaisController,
    required this.ferramentasController,
    required this.resolverNaHora,
    required this.saving,
    required this.takingBeforePhoto,
    required this.hasBeforePhoto,
    required this.onResolverChanged,
    required this.onTakeBeforePhoto,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Vistoria',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: observacaoTecnicaController,
                minLines: 3,
                maxLines: 6,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Observacao tecnica',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Informe a observacao tecnica.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: materiaisController,
                minLines: 2,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Materiais necessarios',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: ferramentasController,
                minLines: 2,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Ferramentas ou equipe necessaria',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Resolver na hora'),
                subtitle: const Text('Avanca o chamado para execucao.'),
                value: resolverNaHora,
                onChanged: saving ? null : onResolverChanged,
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onTakeBeforePhoto,
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
                label: Text(hasBeforePhoto ? 'Foto antes registrada' : 'Foto antes'),
              ),
              const SizedBox(height: 12),
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

class _ExecucaoCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController servicoExecutadoController;
  final TextEditingController observacaoFinalController;
  final bool finishing;
  final bool reopening;
  final bool takingAfterPhoto;
  final bool hasAfterPhoto;
  final VoidCallback? onFinish;
  final VoidCallback? onReopen;
  final VoidCallback? onTakeAfterPhoto;

  const _ExecucaoCard({
    required this.formKey,
    required this.servicoExecutadoController,
    required this.observacaoFinalController,
    required this.finishing,
    required this.reopening,
    required this.takingAfterPhoto,
    required this.hasAfterPhoto,
    required this.onFinish,
    required this.onReopen,
    required this.onTakeAfterPhoto,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Execucao do reparo',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: servicoExecutadoController,
                minLines: 3,
                maxLines: 6,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Servico executado',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Descreva o servico executado.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: observacaoFinalController,
                minLines: 2,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  labelText: 'Observacao final',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onTakeAfterPhoto,
                icon: takingAfterPhoto
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        hasAfterPhoto
                            ? Icons.check_circle
                            : Icons.photo_camera,
                      ),
                label: Text(hasAfterPhoto ? 'Foto final registrada' : 'Foto final'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: reopening ? null : onReopen,
                icon: reopening
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.assignment_return),
                label: const Text('Abrir nova vistoria'),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: finishing ? null : onFinish,
                icon: finishing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle),
                label: const Text('Concluir reparo'),
              ),
            ],
          ),
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
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Chamado concluido',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            const Text('O reparo foi registrado e enviado para o historico.'),
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  final Map<String, dynamic> chamado;

  const _HeaderCard({required this.chamado});

  @override
  Widget build(BuildContext context) {
    final status = (chamado['status'] ?? '-').toString();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    (chamado['numero'] ?? '-').toString(),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                Chip(
                  label: Text(status),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              (chamado['descricao'] ?? '').toString(),
              style: Theme.of(context).textTheme.bodyLarge,
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
        padding: const EdgeInsets.all(16),
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
              _DetailLine(label: 'Observacao', value: chamado['observacao']),
          ],
        ),
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  final String label;
  final Object? value;

  const _DetailLine({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(child: Text((value ?? '-').toString())),
        ],
      ),
    );
  }
}

