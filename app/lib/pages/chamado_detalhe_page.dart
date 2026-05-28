import 'package:flutter/material.dart';

import '../services/api_service.dart';

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
  final _api = const ApiService();

  late Map<String, dynamic> _chamado;
  bool _starting = false;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _chamado = Map<String, dynamic>.from(widget.chamado);
  }

  Future<void> _iniciarVistoria() async {
    setState(() {
      _starting = true;
      _message = '';
    });

    try {
      final updated = await _api.iniciarVistoriaTecnico(
        token: (widget.session['token'] ?? '').toString(),
        chamadoId: (_chamado['id'] ?? '').toString(),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _chamado = {
          ..._chamado,
          ...updated,
        };
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

  @override
  Widget build(BuildContext context) {
    final status = (_chamado['status'] ?? '').toString().toUpperCase();
    final canStart = status == 'ENCAMINHADO';
    final alreadyStarted = status == 'EM_ANALISE';

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
          if (_message.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              _message,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 20),
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

