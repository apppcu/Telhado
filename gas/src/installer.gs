// @version:1.0.0

const WORKSPACE_SCHEMA = {
  centros: [
    'id',
    'sigla',
    'nome',
    'codigo_siga',
    'ativo',
    'observacao',
    'created_at',
    'updated_at'
  ],
  predios: [
    'id',
    'centro_id',
    'centro_sigla',
    'nome',
    'tipo',
    'area_coberta_m2',
    'tipo_cobertura',
    'observacao',
    'ativo',
    'created_at',
    'updated_at'
  ],
  usuarios: [
    'id',
    'nome',
    'email',
    'perfil',
    'centro_sigla',
    'telefone',
    'ativo',
    'created_at',
    'updated_at'
  ],
  chamados: [
    'id',
    'numero',
    'predio_id',
    'centro_sigla',
    'solicitante_id',
    'descricao',
    'categoria',
    'prioridade',
    'status',
    'executante_id',
    'data_abertura',
    'data_fechamento',
    'observacao',
    'created_at',
    'updated_at'
  ],
  historico_chamado: [
    'id',
    'chamado_id',
    'usuario_id',
    'acao',
    'origem',
    'status_anterior',
    'status_novo',
    'observacao',
    'created_at'
  ],
  fotos_chamado: [
    'id',
    'chamado_id',
    'drive_file_id',
    'drive_url',
    'tipo',
    'observacao',
    'created_at'
  ],
  eventos_chuva: [
    'id',
    'data_referencia',
    'data_hora_inicio',
    'data_hora_fim',
    'janela_horas',
    'volume_mm',
    'origem_api',
    'latitude',
    'longitude',
    'cidade',
    'processado',
    'created_at'
  ],
  validacoes_pos_chuva: [
    'id',
    'chamado_id',
    'evento_chuva_id',
    'predio_id',
    'status_validacao',
    'observacao',
    'responsavel_id',
    'created_at',
    'updated_at'
  ],
  configuracoes: [
    'chave',
    'valor',
    'descricao',
    'updated_at'
  ],
  sync_logs: [
    'id',
    'origem',
    'acao',
    'status',
    'referencia_tipo',
    'referencia_id',
    'mensagem',
    'payload_resumo',
    'created_at'
  ]
};

const WORKSPACE_CENTROS = [
  ['CENTRO-PROGRAD', 'PROGRAD', 'Pro-Reitoria de Graduacao'],
  ['CENTRO-PRORH', 'PRORH', 'Pro-Reitoria de Recursos Humanos'],
  ['CENTRO-PROAF', 'PROAF', 'Pro-Reitoria de Administracao e Financas'],
  ['CENTRO-PROEX', 'PROEX', 'Pro-Reitoria de Extensao, Cultura e Sociedade'],
  ['CENTRO-PROPPG', 'PROPPG', 'Pro-Reitoria de Pesquisa e Pos-Graduacao'],
  ['CENTRO-PROPLAN', 'PROPLAN', 'Pro-Reitoria de Planejamento'],
  ['CENTRO-PROAE', 'PROAE', 'Pro-Reitoria de Assuntos Estudantis'],
  ['CENTRO-PCU', 'PCU', 'Prefeitura do Campus Universitario'],
  ['CENTRO-DSG', 'DSG', 'Diretoria de Servicos Gerais'],
  ['CENTRO-DOM', 'DOM', 'Diretoria de Obras e Manutencao'],
  ['CENTRO-DME', 'DME', 'Diretoria de Moveis e Equipamentos'],
  ['CENTRO-CCA', 'CCA', 'Centro de Ciencias Agrarias'],
  ['CENTRO-CCB', 'CCB', 'Centro de Ciencias Biologicas'],
  ['CENTRO-CCE', 'CCE', 'Centro de Ciencias Exatas'],
  ['CENTRO-CCS', 'CCS', 'Centro de Ciencias da Saude'],
  ['CENTRO-CECA', 'CECA', 'Centro de Educacao, Comunicacao e Artes'],
  ['CENTRO-CEFE', 'CEFE', 'Centro de Educacao Fisica e Esportes'],
  ['CENTRO-CCSA', 'CCSA', 'Centro de Ciencias Sociais Aplicadas'],
  ['CENTRO-CCH', 'CCH', 'Centro de Letras e Ciencias Humanas'],
  ['CENTRO-CTU', 'CTU', 'Centro de Tecnologia e Urbanismo']
];

const WORKSPACE_PREDIOS = [
  ['CCA', 'Departamento de Agronomia'],
  ['CCA', 'Departamento de Clinicas Veterinarias'],
  ['CCA', 'Departamento de Ciencia e Tecnologia de Alimentos'],
  ['CCA', 'Departamento de Zootecnia'],
  ['CCB', 'Departamento de Anatomia'],
  ['CCB', 'Departamento de Biologia Geral'],
  ['CCB', 'Departamento de Biologia Animal e Vegetal'],
  ['CCB', 'Departamento de Ciencias Fisiologicas'],
  ['CCB', 'Departamento de Ciencias Patologicas'],
  ['CCB', 'Departamento de Histologia'],
  ['CCB', 'Departamento de Microbiologia'],
  ['CCB', 'Departamento de Psicologia e Psicanalise'],
  ['CCB', 'Departamento de Psicologia Geral e Analise do Comportamento'],
  ['CCB', 'Departamento de Psicologia Social e Institucional'],
  ['CCE', 'Departamento de Bioquimica e Biotecnologia'],
  ['CCE', 'Departamento de Computacao'],
  ['CCE', 'Departamento de Estatistica'],
  ['CCE', 'Departamento de Fisica'],
  ['CCE', 'Departamento de Geociencias'],
  ['CCE', 'Departamento de Geologia e Geomatica'],
  ['CCE', 'Departamento de Matematica'],
  ['CCE', 'Departamento de Quimica'],
  ['CCS', 'Departamento de Clinica Cirurgica'],
  ['CCS', 'Departamento de Clinica Medica'],
  ['CCS', 'Departamento de Ciencias Farmaceuticas'],
  ['CCS', 'Departamento de Enfermagem'],
  ['CCS', 'Departamento de Fisioterapia'],
  ['CCS', 'Departamento de Ginecologia e Obstetricia'],
  ['CCS', 'Departamento de Medicina Oral e Odontologia Infantil'],
  ['CCS', 'Departamento de Odontologia Restauradora'],
  ['CCS', 'Departamento de Odontologia (Area Basica)'],
  ['CCS', 'Departamento de Pediatria e Cirurgia Pediatrica'],
  ['CCS', 'Departamento de Patologia, Analises Clinicas e Toxicologicas'],
  ['CCS', 'Departamento de Saude Coletiva'],
  ['CECA', 'Departamento de Arte Visual'],
  ['CECA', 'Departamento de Ciencia da Informacao'],
  ['CECA', 'Departamento de Comunicacao'],
  ['CECA', 'Departamento de Design'],
  ['CECA', 'Departamento de Educacao'],
  ['CECA', 'Departamento de Musica e Teatro'],
  ['CEFE', 'Departamento de Ciencias do Esporte'],
  ['CEFE', 'Departamento de Educacao Fisica'],
  ['CEFE', 'Departamento de Estudos do Movimento Humano'],
  ['CCSA', 'Departamento de Administracao'],
  ['CCSA', 'Departamento de Ciencias Contabeis'],
  ['CCSA', 'Departamento de Ciencias Economicas'],
  ['CCSA', 'Departamento de Direito Privado'],
  ['CCSA', 'Departamento de Direito Publico'],
  ['CCSA', 'Departamento de Servico Social'],
  ['CCH', 'Departamento de Ciencias Sociais'],
  ['CCH', 'Departamento de Filosofia'],
  ['CCH', 'Departamento de Historia'],
  ['CCH', 'Departamento de Letras Estrangeiras Modernas'],
  ['CCH', 'Departamento de Letras Vernaculas e Classicas'],
  ['CTU', 'Departamento de Arquitetura e Urbanismo'],
  ['CTU', 'Departamento de Construcao Civil'],
  ['CTU', 'Departamento de Engenharia Eletrica'],
  ['CTU', 'Departamento de Estruturas']
];

const WORKSPACE_CONFIG_SEED = [
  ['chuva_mm_minima_relevante', '5', 'Volume minimo de chuva relevante em milimetros.'],
  ['pasta_drive_raiz_id', CONFIG.DRIVE_ROOT_FOLDER_ID, 'ID da pasta raiz do projeto no Google Drive.'],
  ['padrao_numero_chamado_prefixo', 'CH-', 'Prefixo do numero sequencial de chamados.'],
  ['padrao_numero_chamado_digits', '6', 'Quantidade de digitos do sequencial de chamados.'],
  ['open_meteo_latitude', '-23.3045', 'Latitude usada na consulta Open-Meteo.'],
  ['open_meteo_longitude', '-51.1696', 'Longitude usada na consulta Open-Meteo.'],
  ['open_meteo_cidade', 'Londrina', 'Cidade de referencia para monitoramento climatico.'],
  ['open_meteo_timezone', CONFIG.TIMEZONE, 'Timezone usado nas consultas climaticas.']
];

const WORKSPACE_DRIVE_FOLDERS = ['Sistema_Telhados', 'Chamados', 'Relatorios', 'Backup', 'Logs'];

function instalarBancoWorkspace() {
  const result = {
    success: true,
    data: {
      sheets: [],
      centros_inserted: 0,
      predios_inserted: 0,
      configuracoes_inserted: 0,
      drive_folders: []
    },
    error: null
  };

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    ensureWorkspaceSheets_(spreadsheet, result.data);
    seedCentros_(spreadsheet, result.data);
    seedPredios_(spreadsheet, result.data);
    seedConfiguracoes_(spreadsheet, result.data);
    ensureDriveFolders_(result.data);
    appendSyncLog_(spreadsheet, 'SUCESSO', 'Instalacao Workspace concluida.', result.data);
    return result;
  } catch (error) {
    try {
      const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
      appendSyncLog_(spreadsheet, 'ERRO', error.message, { stack: error.stack || '' });
    } catch (logError) {
      Logger.log(logError);
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'WORKSPACE_SETUP_ERROR',
        message: error.message
      }
    };
  }
}

function atualizarCentrosInstitucionais() {
  const summary = {
    centros_inserted: 0,
    centros_updated: 0,
    predios_updated: 0
  };

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    ensureWorkspaceSheets_(spreadsheet, { sheets: [] });
    syncCentrosInstitucionais_(spreadsheet, summary);
    syncPrediosLegacyCentros_(spreadsheet, summary);
    appendSyncLog_(spreadsheet, 'SUCESSO', 'Centros institucionais atualizados.', summary);
    return {
      success: true,
      data: summary,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: {
        code: 'CENTROS_UPDATE_ERROR',
        message: error.message
      }
    };
  }
}

function ensureWorkspaceSheets_(spreadsheet, summary) {
  Object.keys(WORKSPACE_SCHEMA).forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    const headers = WORKSPACE_SCHEMA[sheetName];
    ensureHeaders_(sheet, headers);
    formatSheet_(sheet, headers.length);
    summary.sheets.push(sheetName);
  });
}

function ensureHeaders_(sheet, expectedHeaders) {
  if (sheet.getMaxColumns() < expectedHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), expectedHeaders.length - sheet.getMaxColumns());
  }

  const currentHeaders = sheet.getRange(1, 1, 1, expectedHeaders.length).getValues()[0];
  const hasAnyHeader = currentHeaders.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return;
  }

  expectedHeaders.forEach(function(header, index) {
    const current = String(currentHeaders[index] || '').trim();
    if (current === '') {
      sheet.getRange(1, index + 1).setValue(header);
      return;
    }

    if (current !== header) {
      throw new Error('Conflito de cabecalho na aba ' + sheet.getName() + ': esperado "' + header + '" na coluna ' + (index + 1) + ', encontrado "' + current + '".');
    }
  });
}

function formatSheet_(sheet, headerCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headerCount)
    .setFontWeight('bold')
    .setBackground('#e8f0fe');

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), headerCount).createFilter();
  sheet.autoResizeColumns(1, headerCount);
}

function seedCentros_(spreadsheet, summary) {
  const sheet = spreadsheet.getSheetByName('centros');
  const existing = getExistingKeys_(sheet, 1);
  const now = now_();
  const rows = [];

  WORKSPACE_CENTROS.forEach(function(centro) {
    if (existing[centro[0]]) {
      return;
    }

    rows.push([
      centro[0],
      centro[1],
      centro[2],
      '',
      true,
      '',
      now,
      now
    ]);
  });

  appendRows_(sheet, rows);
  summary.centros_inserted = rows.length;
}

function syncCentrosInstitucionais_(spreadsheet, summary) {
  const sheet = spreadsheet.getSheetByName('centros');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];
  const now = now_();
  const bySigla = {};
  const byId = {};
  const legacySiglas = {
    CESA: 'CCSA',
    CLCH: 'CCH'
  };

  rows.forEach(function(row, offset) {
    const rowNumber = offset + 2;
    const id = String(row[index.id] || '').trim();
    const sigla = String(row[index.sigla] || '').trim().toUpperCase();

    if (id) {
      byId[id] = { row: row, rowNumber: rowNumber };
    }
    if (sigla) {
      bySigla[sigla] = { row: row, rowNumber: rowNumber };
    }
  });

  Object.keys(legacySiglas).forEach(function(legacy) {
    const canonicalSigla = legacySiglas[legacy];
    const canonical = findCentroSeedBySigla_(canonicalSigla);
    const legacyEntry = bySigla[legacy];

    if (!legacyEntry || !canonical) {
      return;
    }

    sheet.getRange(legacyEntry.rowNumber, index.id + 1).setValue(canonical[0]);
    sheet.getRange(legacyEntry.rowNumber, index.sigla + 1).setValue(canonical[1]);
    sheet.getRange(legacyEntry.rowNumber, index.nome + 1).setValue(canonical[2]);
    sheet.getRange(legacyEntry.rowNumber, index.ativo + 1).setValue(true);
    sheet.getRange(legacyEntry.rowNumber, index.updated_at + 1).setValue(now);
    summary.centros_updated++;

    byId[canonical[0]] = legacyEntry;
    bySigla[canonical[1]] = legacyEntry;
    delete bySigla[legacy];
  });

  WORKSPACE_CENTROS.forEach(function(centro) {
    const entry = bySigla[centro[1]] || byId[centro[0]];

    if (entry) {
      sheet.getRange(entry.rowNumber, index.id + 1).setValue(centro[0]);
      sheet.getRange(entry.rowNumber, index.sigla + 1).setValue(centro[1]);
      sheet.getRange(entry.rowNumber, index.nome + 1).setValue(centro[2]);
      sheet.getRange(entry.rowNumber, index.ativo + 1).setValue(true);
      sheet.getRange(entry.rowNumber, index.updated_at + 1).setValue(now);
      summary.centros_updated++;
      return;
    }

    appendRows_(sheet, [[
      centro[0],
      centro[1],
      centro[2],
      '',
      true,
      '',
      now,
      now
    ]]);
    summary.centros_inserted++;
  });
}

function syncPrediosLegacyCentros_(spreadsheet, summary) {
  const sheet = spreadsheet.getSheetByName('predios');
  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const replacements = {
    CESA: { id: 'CENTRO-CCSA', sigla: 'CCSA' },
    CLCH: { id: 'CENTRO-CCH', sigla: 'CCH' }
  };

  values.forEach(function(row, offset) {
    const sigla = String(row[index.centro_sigla] || '').trim().toUpperCase();
    const replacement = replacements[sigla];

    if (!replacement) {
      return;
    }

    const rowNumber = offset + 2;
    sheet.getRange(rowNumber, index.centro_id + 1).setValue(replacement.id);
    sheet.getRange(rowNumber, index.centro_sigla + 1).setValue(replacement.sigla);
    if (index.updated_at >= 0) {
      sheet.getRange(rowNumber, index.updated_at + 1).setValue(now_());
    }
    summary.predios_updated++;
  });
}

function findCentroSeedBySigla_(sigla) {
  const target = String(sigla || '').trim().toUpperCase();

  for (var i = 0; i < WORKSPACE_CENTROS.length; i++) {
    if (WORKSPACE_CENTROS[i][1] === target) {
      return WORKSPACE_CENTROS[i];
    }
  }

  return null;
}

function seedPredios_(spreadsheet, summary) {
  const sheet = spreadsheet.getSheetByName('predios');
  const existing = getExistingKeys_(sheet, 1);
  const now = now_();
  const rows = [];

  WORKSPACE_PREDIOS.forEach(function(predio) {
    const centroSigla = predio[0];
    const nome = predio[1];
    const id = 'PRED-' + centroSigla + '-' + slug_(nome.replace(/^Departamento de /, ''));

    if (existing[id]) {
      return;
    }

    rows.push([
      id,
      'CENTRO-' + centroSigla,
      centroSigla,
      nome,
      'DEPARTAMENTO',
      '',
      'DESCONHECIDA',
      '',
      true,
      now,
      now
    ]);
  });

  appendRows_(sheet, rows);
  summary.predios_inserted = rows.length;
}

function seedConfiguracoes_(spreadsheet, summary) {
  const sheet = spreadsheet.getSheetByName('configuracoes');
  const existing = getExistingKeys_(sheet, 1);
  const now = now_();
  const rows = [];

  WORKSPACE_CONFIG_SEED.forEach(function(config) {
    if (existing[config[0]]) {
      return;
    }

    rows.push([config[0], config[1], config[2], now]);
  });

  appendRows_(sheet, rows);
  summary.configuracoes_inserted = rows.length;
}

function ensureDriveFolders_(summary) {
  const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  const sistema = getOrCreateChildFolder_(root, 'Sistema_Telhados');
  summary.drive_folders.push(folderSummary_(sistema));

  ['Chamados', 'Relatorios', 'Backup', 'Logs'].forEach(function(folderName) {
    const folder = getOrCreateChildFolder_(sistema, folderName);
    summary.drive_folders.push(folderSummary_(folder));
  });
}

function getOrCreateChildFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

function folderSummary_(folder) {
  return {
    name: folder.getName(),
    id: folder.getId()
  };
}

function getExistingKeys_(sheet, keyColumn) {
  const lastRow = sheet.getLastRow();
  const existing = {};

  if (lastRow < 2) {
    return existing;
  }

  const values = sheet.getRange(2, keyColumn, lastRow - 1, 1).getValues();
  values.forEach(function(row) {
    const key = String(row[0] || '').trim();
    if (key) {
      existing[key] = true;
    }
  });

  return existing;
}

function appendRows_(sheet, rows) {
  if (!rows.length) {
    return;
  }
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function headerIndex_(headers) {
  const index = {};
  headers.forEach(function(header, position) {
    index[String(header || '').trim()] = position;
  });
  return index;
}

function appendSyncLog_(spreadsheet, status, message, payload) {
  const sheet = spreadsheet.getSheetByName('sync_logs');
  if (!sheet) {
    return;
  }

  sheet.appendRow([
    'LOG-' + Utilities.getUuid(),
    'SCRIPT_AUTOMATICO',
    'instalarBancoWorkspace',
    status,
    'WORKSPACE',
    CONFIG.SPREADSHEET_ID,
    message,
    JSON.stringify(payload || {}),
    now_()
  ]);
}

function now_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function slug_(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}
