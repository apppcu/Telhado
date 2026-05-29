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
  void dispose() {
    _loginController.dispose();
    _senhaController.dispose();
    super.dispose();
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
      backgroundColor: const Color(0xFFF3F6F4),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: const BorderSide(color: Color(0xFFD7E1DC)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: colorScheme.primary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'UEL',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        const Text(
                          'Controle Telhado',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Acesso da equipe de manutencao',
                          style: TextStyle(color: Color(0xFF5F6E68)),
                        ),
                        const SizedBox(height: 24),
                        TextFormField(
                          controller: _loginController,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Login',
                            border: OutlineInputBorder(),
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
                            border: const OutlineInputBorder(),
                            suffixIcon: IconButton(
                              tooltip: _obscurePassword ? 'Mostrar senha' : 'Ocultar senha',
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                              icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                            ),
                          ),
                          validator: (_) => null,
                        ),
                        if (_message.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Text(
                            _message,
                            style: TextStyle(color: colorScheme.error),
                          ),
                        ],
                        const SizedBox(height: 22),
                        FilledButton(
                          onPressed: _loading ? null : _submit,
                          child: _loading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Entrar'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
