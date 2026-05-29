import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../services/auth_cache_service.dart';
import '../services/sync_service.dart';
import 'chamados_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _loginController = TextEditingController();
  final _senhaController = TextEditingController();
  final _api = const ApiService();
  final _authCache = AuthCacheService();
  final _sync = SyncService();

  bool _loading = false;
  bool _obscurePassword = true;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _carregarSessaoSalva();
  }

  @override
  void dispose() {
    _loginController.dispose();
    _senhaController.dispose();
    super.dispose();
  }

  Future<void> _carregarSessaoSalva() async {
    final login = await _authCache.ultimoLogin();
    final session = await _authCache.carregarSessaoValida();

    if (!mounted) {
      return;
    }

    if (login.isNotEmpty) {
      _loginController.text = login;
    }

    if (session != null) {
      _abrirSessaoOffline(session);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _loading = true;
      _message = '';
    });

    try {
      final login = _loginController.text.trim();
      final senha = _senhaController.text;
      if (senha.isEmpty) {
        final offlineSession = await _authCache.loginOffline(login: login);
        if (offlineSession != null) {
          _abrirSessaoOffline(offlineSession);
          return;
        }

        throw Exception(
          'Informe a senha para entrar online ou conecte-se antes que a sessao salva expire.',
        );
      }

      final session = await _api.loginTecnico(
        login: login,
        senha: senha,
      );
      await _authCache.salvarSessaoDiaria(
        login: login,
        session: session,
      );
      await _sync.sincronizarPendencias();

      if (!mounted) {
        return;
      }

      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ChamadosPage(session: session),
        ),
      );
    } catch (error) {
      final offlineSession = await _authCache.loginOffline(
        login: _loginController.text,
      );

      if (offlineSession != null) {
        _abrirSessaoOffline(offlineSession);
        return;
      }

      setState(() {
        _message = '${error.toString().replaceFirst('Exception: ', '')} '
            'Para entrar offline, e preciso ter uma sessao valida salva neste aparelho.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _abrirSessaoOffline(Map<String, dynamic> session) {
    session['offline_login'] = true;
    if (!mounted) {
      return;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => ChamadosPage(session: session),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: colorScheme.primary,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'UEL',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 12),
                        Text(
                          'Controle Telhado',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Manutencao em campo',
                          style: TextStyle(color: Color(0xFFD9EEE7)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Entrar',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                            ),
                            const SizedBox(height: 18),
                            TextFormField(
                              controller: _loginController,
                              textInputAction: TextInputAction.next,
                              decoration: const InputDecoration(
                                labelText: 'Login',
                                prefixIcon: Icon(Icons.person_outline),
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Informe o login.';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),
                            TextFormField(
                              controller: _senhaController,
                              obscureText: _obscurePassword,
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                labelText: 'Senha',
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  tooltip: _obscurePassword
                                      ? 'Mostrar senha'
                                      : 'Ocultar senha',
                                  onPressed: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                  },
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility
                                        : Icons.visibility_off,
                                  ),
                                ),
                              ),
                              validator: (_) => null,
                            ),
                            if (_message.isNotEmpty) ...[
                              const SizedBox(height: 14),
                              _LoginMessage(message: _message),
                            ],
                            const SizedBox(height: 20),
                            FilledButton.icon(
                              onPressed: _loading ? null : _submit,
                              icon: _loading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.login),
                              label: const Text('Entrar'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginMessage extends StatelessWidget {
  final String message;

  const _LoginMessage({required this.message});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline, color: colorScheme.onErrorContainer),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: colorScheme.onErrorContainer),
            ),
          ),
        ],
      ),
    );
  }
}
