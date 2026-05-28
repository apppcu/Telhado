import 'package:flutter/material.dart';

import '../services/api_service.dart';

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

  late Map<String, dynamic> _session;
  bool _loading = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _session = Map<String, dynamic>.from(widget.session);
  }

  @override
  void dispose() {
    _novaSenhaController.dispose();
    _confirmarSenhaController.dispose();
    super.dispose();
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

  @override
  Widget build(BuildContext context) {
    final tecnico = _session['tecnico'] as Map<String, dynamic>? ?? {};
    final trocarSenha = _session['trocar_senha'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Meus servicos'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Conectado como ${tecnico['nome'] ?? 'tecnico'}',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text('Login: ${tecnico['login'] ?? '-'}'),
            const SizedBox(height: 16),
            if (trocarSenha)
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
              )
            else
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Senha atualizada. Lista de servicos sera o proximo passo.'),
                ),
              ),
          ],
        ),
      ),
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
