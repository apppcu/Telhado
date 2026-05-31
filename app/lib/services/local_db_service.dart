import 'dart:convert';

import 'package:path/path.dart' as path;
import 'package:sqflite/sqflite.dart';

class LocalDbService {
  LocalDbService._();

  static final LocalDbService instance = LocalDbService._();

  Database? _database;

  Future<Database> get database async {
    final existing = _database;
    if (existing != null) {
      return existing;
    }

    final databasesPath = await getDatabasesPath();
    final dbPath = path.join(databasesPath, 'controle_telhado.db');
    final database = await openDatabase(
      dbPath,
      version: 1,
      onCreate: _createSchema,
    );

    _database = database;
    return database;
  }

  Future<void> init() async {
    await database;
  }

  Future<int> salvarChamadoCache(Map<String, dynamic> chamado) async {
    final db = await database;
    final id = (chamado['id'] ?? '').toString();
    if (_isChamadoConcluido(chamado)) {
      return db.delete(
        'chamados_cache',
        where: 'id = ?',
        whereArgs: [id],
      );
    }

    final now = DateTime.now().toIso8601String();
    return db.insert(
      'chamados_cache',
      {
        'id': id,
        'payload_json': jsonEncode(chamado),
        'updated_at': now,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> listarChamadosCache() async {
    final db = await database;
    final rows = await db.query('chamados_cache', orderBy: 'updated_at DESC');
    return rows
        .map((row) => jsonDecode(row['payload_json'] as String))
        .cast<Map<String, dynamic>>()
        .where((chamado) => !_isChamadoConcluido(chamado))
        .toList();
  }

  Future<int> enfileirarOperacao({
    required String action,
    required Map<String, dynamic> payload,
    String? photoPath,
  }) async {
    final db = await database;
    final now = DateTime.now().toIso8601String();
    return db.insert('sync_queue', {
      'action': action,
      'payload_json': jsonEncode(payload),
      'photo_path': photoPath,
      'status': 'PENDENTE',
      'attempts': 0,
      'last_error': '',
      'created_at': now,
      'updated_at': now,
    });
  }

  Future<List<Map<String, dynamic>>> listarPendencias() async {
    final db = await database;
    return db.query(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['PENDENTE'],
      orderBy: 'id ASC',
    );
  }

  Future<void> marcarSincronizado(int id) async {
    final db = await database;
    await db.update(
      'sync_queue',
      {
        'status': 'SINCRONIZADO',
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> marcarFalha(int id, String error) async {
    final db = await database;
    await db.rawUpdate(
      '''
      UPDATE sync_queue
      SET attempts = attempts + 1,
          last_error = ?,
          updated_at = ?
      WHERE id = ?
      ''',
      [error, DateTime.now().toIso8601String(), id],
    );
  }

  Future<void> removerSincronizados() async {
    final db = await database;
    await db.delete(
      'sync_queue',
      where: 'status = ?',
      whereArgs: ['SINCRONIZADO'],
    );
  }

  Future<void> _createSchema(Database db, int version) async {
    await db.execute('''
      CREATE TABLE chamados_cache (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    await db.execute('''
      CREATE TABLE sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        photo_path TEXT,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');
  }

  bool _isChamadoConcluido(Map<String, dynamic> chamado) {
    final status = _normalizeStatusKey(chamado['status'])
        .replaceAll(RegExp(r'\s+'), '_')
        .replaceAll('-', '_');
    return status == 'CONCLUIDO';
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
}
