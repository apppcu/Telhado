import 'package:flutter/material.dart';
import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../services/api_service.dart';
import '../services/local_db_service.dart';
import '../services/sync_service.dart';
import 'chamado_detalhe_page.dart';

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
      await _sync.sincronizarPendencias();
      return;
    }

    if (_session['offline_login'] == true) {
      await _tryRestoreOnlineSession();
      return;
    }

    await _loadChamados();
  }

  Future<void> _tryRestoreOnlineSession() async {
    setState(() {
      _loadingChamados = true;
      _chamadosMessage = '';
    });

    try {
      await _sync.sincronizarPendencias();
      final chamados = await _api.listarChamadosTecnico(
        token: (_session['token'] ?? '').toString(),
      );
      for (final chamado in chamados) {
        await _localDb.salvarChamadoCache(chamado);
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _session = {
          ..._session,
          'offline_login': false,
        };
        _chamados = chamados;
        _chamadosMessage = 'Conexao restabelecida. Servicos atualizados.';
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

      await _sync.sincronizarPendencias();
      final chamados = await _api.listarChamadosTecnico(
        token: (_session['token'] ?? '').toString(),
      );
      for (final chamado in chamados) {
        await _localDb.salvarChamadoCache(chamado);
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _chamados = chamados;
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
        ],
      ),
      body: RefreshIndicator(
        onRefresh: trocarSenha ? () async {} : _loadChamados,
        child: ListView(
          padding: const EdgeInsets.all(24),
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
}

class _TechnicianHeader extends StatelessWidget {
  final Map<String, dynamic> tecnico;

  const _TechnicianHeader({required this.tecnico});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Conectado como ${tecnico['nome'] ?? 'tecnico'}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text('Login: ${tecnico['login'] ?? '-'}'),
      ],
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
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.construction, color: colorScheme.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    loading ? 'Atualizando servicos...' : '$total servico(s) atribuido(s)',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  if (message.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      message,
                      style: TextStyle(color: colorScheme.error),
                    ),
                  ],
                ],
              ),
            ),
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
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Text('Nenhum servico atribuido no momento.'),
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
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                _StatusChip(label: status),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              (chamado['descricao'] ?? '').toString(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 10),
            Text(
              '${chamado['centro_sigla'] ?? '-'} - ${chamado['predio_nome'] ?? chamado['predio_id'] ?? '-'}',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _PriorityChip(label: priority),
                const Spacer(),
                TextButton(
                  onPressed: onOpen,
                  child: const Text('Abrir'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;

  const _StatusChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label),
      visualDensity: VisualDensity.compact,
    );
  }
}

class _PriorityChip extends StatelessWidget {
  final String label;

  const _PriorityChip({required this.label});

  @override
  Widget build(BuildContext context) {
    final urgent = label.toUpperCase() == 'URGENTE';
    final colorScheme = Theme.of(context).colorScheme;

    return Chip(
      label: Text(label),
      visualDensity: VisualDensity.compact,
      backgroundColor: urgent ? colorScheme.errorContainer : null,
      labelStyle: urgent ? TextStyle(color: colorScheme.onErrorContainer) : null,
    );
  }
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
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Trocar senha',
                style: Theme.of(context).textTheme.titleMedium,
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
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    tooltip: obscureNewPassword ? 'Mostrar senha' : 'Ocultar senha',
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
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    tooltip: obscureConfirmPassword ? 'Mostrar senha' : 'Ocultar senha',
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
                Text(
                  message,
                  style: TextStyle(color: colorScheme.error),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onSubmit,
                child: loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Salvar nova senha'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
