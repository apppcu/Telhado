import 'package:flutter/material.dart';
import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../services/api_service.dart';
import '../services/auth_cache_service.dart';
import '../services/local_db_service.dart';
import '../services/sync_service.dart';
import '../widgets/chamado_badges.dart';
import 'chamado_detalhe_page.dart';
import 'login_page.dart';

class ChamadosPage extends StatefulWidget {
  final Map<String, dynamic> session;

  const ChamadosPage({
    super.key,
    required this.session,
  });

  @override
  State<ChamadosPage> createState() => _ChamadosPageState();
}

class _ChamadosPageState extends State<ChamadosPage> {
  final _formKey = GlobalKey<FormState>();
  final _novaSenhaController = TextEditingController();
  final _confirmarSenhaController = TextEditingController();
  final _api = const ApiService();
  final _authCache = AuthCacheService();
  final _localDb = LocalDbService.instance;
  final _sync = SyncService();
  StreamSubscription<ConnectivityResult>? _connectivitySubscription;

  late Map<String, dynamic> _session;
  List<Map<String, dynamic>> _chamados = [];
  bool _loading = false;
  bool _loadingChamados = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  String _message = '';
  String _chamadosMessage = '';

  @override
  void initState() {
    super.initState();
    _session = Map<String, dynamic>.from(widget.session);
    _connectivitySubscription = _sync.connectivityChanges().listen((status) {
      if (status != ConnectivityResult.none) {
        _syncAndRefresh();
      }
    });
    if (_session['trocar_senha'] != true) {
      _loadChamados();
    }
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _novaSenhaController.dispose();
    _confirmarSenhaController.dispose();
    super.dispose();
  }

  Future<void> _syncAndRefresh() async {
    if (_session['trocar_senha'] == true) {
      await _sync.sincronizarPendencias(tokenAtual: _sessionToken());
      return;
    }

    if (_session['offline_login'] == true) {
      await _tryRestoreOnlineSession();
      return;
    }

    await _loadChamados();
  }

  Future<void> _sair() async {
    await _authCache.limparSessao();

    if (!mounted) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginPage()),
      (_) => false,
    );
  }

  Future<void> _tryRestoreOnlineSession() async {
    setState(() {
      _loadingChamados = true;
      _chamadosMessage = '';
    });

    try {
      final syncResult = await _sync.sincronizarPendencias(
        tokenAtual: _sessionToken(),
      );
      final chamados = await _api.listarChamadosTecnico(
        token: (_session['token'] ?? '').toString(),
      );
      for (final chamado in chamados) {
        await _localDb.salvarChamadoCache(chamado);
      }
      final visibleChamados = _filtrarChamadosVisiveis(chamados);

      if (!mounted) {
        return;
      }

      setState(() {
        _session = {
          ..._session,
          'offline_login': false,
        };
        _chamados = visibleChamados;
        _chamadosMessage = syncResult.failed > 0
            ? _syncFailureMessage(
                syncResult,
                'Conexao restabelecida, mas ainda ha pendencias.',
              )
            : 'Conexao restabelecida. Servicos atualizados.';
      });
    } catch (_) {
      final cached = await _localDb.listarChamadosCache();
      if (!mounted) {
        return;
      }

      setState(() {
        _chamados = cached;
        _chamadosMessage = cached.isEmpty
            ? 'Sem servicos salvos neste aparelho.'
            : 'Modo offline: exibindo servicos salvos.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingChamados = false;
        });
      }
    }
  }

  Future<void> _trocarSenha() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _loading = true;
      _message = '';
    });

    try {
      final updatedSession = await _api.trocarSenhaTecnico(
        token: (_session['token'] ?? '').toString(),
        novaSenha: _novaSenhaController.text,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _session = updatedSession;
        _novaSenhaController.clear();
        _confirmarSenhaController.clear();
      });
      await _loadChamados();
    } catch (error) {
      setState(() {
        _message = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadChamados() async {
    setState(() {
      _loadingChamados = true;
      _chamadosMessage = '';
    });

    try {
      if (_session['offline_login'] == true) {
        await _tryRestoreOnlineSession();
        return;
      }

      final syncResult = await _sync.sincronizarPendencias(
        tokenAtual: _sessionToken(),
      );
      final chamados = await _api.listarChamadosTecnico(
        token: (_session['token'] ?? '').toString(),
      );
      for (final chamado in chamados) {
        await _localDb.salvarChamadoCache(chamado);
      }
      final visibleChamados = _filtrarChamadosVisiveis(chamados);

      if (!mounted) {
        return;
      }

      setState(() {
        _chamados = visibleChamados;
        _chamadosMessage = syncResult.failed > 0
            ? _syncFailureMessage(
                syncResult,
                'Servicos atualizados, mas ainda ha pendencias.',
              )
            : '';
      });
    } catch (error) {
      final cached = await _localDb.listarChamadosCache();
      if (!mounted) {
        return;
      }

      setState(() {
        _chamados = cached;
        _chamadosMessage = cached.isEmpty
            ? error.toString().replaceFirst('Exception: ', '')
            : 'Sem conexao. Exibindo servicos salvos no aparelho.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingChamados = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tecnico = _session['tecnico'] as Map<String, dynamic>? ?? {};
    final trocarSenha = _session['trocar_senha'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meus servicos'),
        actions: [
          if (!trocarSenha)
            IconButton(
              tooltip: 'Atualizar',
              onPressed: _loadingChamados ? null : _loadChamados,
              icon: const Icon(Icons.refresh),
            ),
          IconButton(
            tooltip: 'Sair',
            onPressed: _sair,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: trocarSenha ? () async {} : _loadChamados,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            _TechnicianHeader(tecnico: tecnico),
            const SizedBox(height: 16),
            if (trocarSenha) ...[
              _ChangePasswordCard(
                formKey: _formKey,
                novaSenhaController: _novaSenhaController,
                confirmarSenhaController: _confirmarSenhaController,
                loading: _loading,
                message: _message,
                obscureNewPassword: _obscureNewPassword,
                obscureConfirmPassword: _obscureConfirmPassword,
                onToggleNewPassword: () {
                  setState(() {
                    _obscureNewPassword = !_obscureNewPassword;
                  });
                },
                onToggleConfirmPassword: () {
                  setState(() {
                    _obscureConfirmPassword = !_obscureConfirmPassword;
                  });
                },
                onSubmit: _loading ? null : _trocarSenha,
              ),
            ] else ...[
              _ServicesSummary(
                loading: _loadingChamados,
                total: _chamados.length,
                message: _chamadosMessage,
              ),
              const SizedBox(height: 12),
              if (_loadingChamados && _chamados.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_chamados.isEmpty)
                const _EmptyServicesCard()
              else
                ..._chamados.map(
                  (chamado) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ChamadoCard(
                      chamado: chamado,
                      onOpen: () => _showChamadoDetails(chamado),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _showChamadoDetails(Map<String, dynamic> chamado) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ChamadoDetalhePage(
          session: _session,
          chamado: chamado,
        ),
      ),
    );

    if (mounted && _session['trocar_senha'] != true) {
      await _loadChamados();
    }
  }

  List<Map<String, dynamic>> _filtrarChamadosVisiveis(
    List<Map<String, dynamic>> chamados,
  ) {
    return chamados.where((chamado) {
      return _normalizeStatusValue(chamado['status']) != 'CONCLUIDO';
    }).toList();
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
    return (_session['token'] ?? '').toString();
  }
}

class _TechnicianHeader extends StatelessWidget {
  final Map<String, dynamic> tecnico;

  const _TechnicianHeader({required this.tecnico});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.primary,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.engineering, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  (tecnico['nome'] ?? 'Tecnico').toString(),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Login: ${tecnico['login'] ?? '-'}',
                  style: const TextStyle(color: Color(0xFFD9EEE7)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NoticeBox extends StatelessWidget {
  final String message;
  final bool isError;

  const _NoticeBox({
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
            isError ? Icons.error_outline : Icons.wifi_tethering,
            color: foreground,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: foreground),
            ),
          ),
        ],
      ),
    );
  }
}

class _ServicesSummary extends StatelessWidget {
  final bool loading;
  final int total;
  final String message;

  const _ServicesSummary({
    required this.loading,
    required this.total,
    required this.message,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE7F3EE),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.roofing, color: colorScheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    loading
                        ? 'Atualizando servicos...'
                        : '$total servico(s) atribuido(s)',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                  ),
                ),
                if (loading)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            if (message.isNotEmpty) ...[
              const SizedBox(height: 12),
              _NoticeBox(
                message: message,
                isError: message.toLowerCase().contains('erro'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyServicesCard extends StatelessWidget {
  const _EmptyServicesCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Icon(
              Icons.inbox_outlined,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text('Nenhum servico atribuido no momento.'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChamadoCard extends StatelessWidget {
  final Map<String, dynamic> chamado;
  final VoidCallback onOpen;

  const _ChamadoCard({
    required this.chamado,
    required this.onOpen,
  });

  @override
  Widget build(BuildContext context) {
    final priority = (chamado['prioridade'] ?? 'NORMAL').toString();
    final status = _normalizeStatusValue(chamado['status']);
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 5, color: colorScheme.primary),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              (chamado['numero'] ?? '-').toString(),
                              style: Theme.of(context)
                                  .textTheme
                                  .titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                          ),
                          ChamadoStatusChip(label: status),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        (chamado['descricao'] ?? '').toString(),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.place_outlined,
                            size: 18,
                            color: colorScheme.onSurfaceVariant,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '${chamado['centro_sigla'] ?? '-'} - ${chamado['predio_nome'] ?? chamado['predio_id'] ?? '-'}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          ChamadoPriorityChip(label: priority),
                          const Spacer(),
                          TextButton.icon(
                            onPressed: onOpen,
                            icon: const Icon(Icons.chevron_right),
                            label: const Text('Abrir'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _normalizeStatusValue(dynamic value) {
  final normalized = _normalizeStatusKey(value)
      .replaceAll(RegExp(r'\s+'), '_')
      .replaceAll('-', '_');
  switch (normalized) {
    case 'EM_EXECUCAO':
    case 'EM_ANALISE':
    case 'ENCAMINHADO':
    case 'ABERTO':
    case 'CONCLUIDO':
      return normalized;
    default:
      return 'ABERTO';
  }
}

String _normalizeStatusKey(dynamic value) {
  return (value ?? '')
      .toString()
      .trim()
      .toUpperCase()
      .replaceAll(RegExp(r'[ÁÀÂÃÄ]'), 'A')
      .replaceAll(RegExp(r'[ÉÈÊË]'), 'E')
      .replaceAll(RegExp(r'[ÍÌÎÏ]'), 'I')
      .replaceAll(RegExp(r'[ÓÒÔÕÖ]'), 'O')
      .replaceAll(RegExp(r'[ÚÙÛÜ]'), 'U')
      .replaceAll('Ç', 'C');
}

class _ChangePasswordCard extends StatelessWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController novaSenhaController;
  final TextEditingController confirmarSenhaController;
  final bool loading;
  final String message;
  final bool obscureNewPassword;
  final bool obscureConfirmPassword;
  final VoidCallback onToggleNewPassword;
  final VoidCallback onToggleConfirmPassword;
  final VoidCallback? onSubmit;

  const _ChangePasswordCard({
    required this.formKey,
    required this.novaSenhaController,
    required this.confirmarSenhaController,
    required this.loading,
    required this.message,
    required this.obscureNewPassword,
    required this.obscureConfirmPassword,
    required this.onToggleNewPassword,
    required this.onToggleConfirmPassword,
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
                'Trocar senha',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Primeiro acesso detectado. Cadastre uma senha com pelo menos uma letra maiuscula e um numero.',
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: novaSenhaController,
                obscureText: obscureNewPassword,
                decoration: InputDecoration(
                  labelText: 'Nova senha',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    tooltip:
                        obscureNewPassword ? 'Mostrar senha' : 'Ocultar senha',
                    onPressed: onToggleNewPassword,
                    icon: Icon(
                      obscureNewPassword ? Icons.visibility : Icons.visibility_off,
                    ),
                  ),
                ),
                validator: (value) {
                  final password = value ?? '';
                  if (password.length < 6) {
                    return 'Use pelo menos 6 caracteres.';
                  }
                  if (!RegExp(r'[A-Z]').hasMatch(password)) {
                    return 'Inclua uma letra maiuscula.';
                  }
                  if (!RegExp(r'[0-9]').hasMatch(password)) {
                    return 'Inclua um numero.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: confirmarSenhaController,
                obscureText: obscureConfirmPassword,
                onFieldSubmitted: (_) => onSubmit?.call(),
                decoration: InputDecoration(
                  labelText: 'Confirmar senha',
                  prefixIcon: const Icon(Icons.lock_reset),
                  suffixIcon: IconButton(
                    tooltip: obscureConfirmPassword
                        ? 'Mostrar senha'
                        : 'Ocultar senha',
                    onPressed: onToggleConfirmPassword,
                    icon: Icon(
                      obscureConfirmPassword ? Icons.visibility : Icons.visibility_off,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value != novaSenhaController.text) {
                    return 'As senhas precisam ser iguais.';
                  }
                  return null;
                },
              ),
              if (message.isNotEmpty) ...[
                const SizedBox(height: 14),
                _NoticeBox(message: message, isError: true),
              ],
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onSubmit,
                icon: loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save),
                label: const Text('Salvar nova senha'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
