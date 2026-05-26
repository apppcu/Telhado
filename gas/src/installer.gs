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
  ['CENTRO-CCA', 'CCA', 'Centro de Ciencias Agrarias'],
  ['CENTRO-CCB', 'CCB', 'Centro de Ciencias Biologicas'],
  ['CENTRO-CCE', 'CCE', 'Centro de Ciencias Exatas'],
  ['CENTRO-CCS', 'CCS', 'Centro de Ciencias da Saude'],
  ['CENTRO-CECA', 'CECA', 'Centro de Educacao, Comunicacao e Artes'],
  ['CENTRO-CEFE', 'CEFE', 'Centro de Educacao Fisica e Esportes'],
  ['CENTRO-CESA', 'CESA', 'Centro de Estudos Sociais Aplicados'],
  ['CENTRO-CLCH', 'CLCH', 'Centro de Letras e Ciencias Humanas'],
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
  ['CESA', 'Departamento de Administracao'],
  ['CESA', 'Departamento de Ciencias Contabeis'],
  ['CESA', 'Departamento de Ciencias Economicas'],
  ['CESA', 'Departamento de Direito Privado'],
  ['CESA', 'Departamento de Direito Publico'],
  ['CESA', 'Departamento de Servico Social'],
  ['CLCH', 'Departamento de Ciencias Sociais'],
  ['CLCH', 'Departamento de Filosofia'],
  ['CLCH', 'Departamento de Historia'],
  ['CLCH', 'Departamento de Letras Estrangeiras Modernas'],
  ['CLCH', 'Departamento de Letras Vernaculas e Classicas'],
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
