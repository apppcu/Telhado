import 'package:flutter/material.dart';

class ChamadoStatusChip extends StatelessWidget {
  final String label;

  const ChamadoStatusChip({
    super.key,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return _InfoChip(label: label, colors: _statusColors(context, label));
  }
}

class ChamadoPriorityChip extends StatelessWidget {
  final String label;

  const ChamadoPriorityChip({
    super.key,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return _InfoChip(label: label, colors: _priorityColors(context, label));
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

_BadgeColors _priorityColors(BuildContext context, String label) {
  final colorScheme = Theme.of(context).colorScheme;
  switch (label.trim().toUpperCase()) {
    case 'ALTA':
    case 'URGENTE':
      return _BadgeColors(
        background: colorScheme.errorContainer,
        foreground: colorScheme.onErrorContainer,
      );
    case 'MEDIA':
      return const _BadgeColors(
        background: Color(0xFFFFE8B7),
        foreground: Color(0xFF5A3A00),
      );
    default:
      return const _BadgeColors(
        background: Color(0xFFE7F3EE),
        foreground: Color(0xFF0D5F4D),
      );
  }
}

class _InfoChip extends StatelessWidget {
  final String label;
  final _BadgeColors colors;

  const _InfoChip({
    required this.label,
    required this.colors,
  });

  @override
  Widget build(BuildContext context) {
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
