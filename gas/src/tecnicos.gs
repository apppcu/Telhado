const TECNICOS_SCHEMA = [
  'id',
  'nome',
  'email',
  'telefone',
  'especialidade',
  'ativo',
  'created_at',
  'updated_at'
];

function listarTecnicosManutencao(payload) {
  try {
    const admin = getAuthorizedUserFromPayload_(payload);
    if (!isActiveAdmin_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem consultar tecnicos.');
    }

    return success_(getTecnicosAtivos_());
  } catch (error) {
    return accessError_('LISTAR_TECNICOS_ERROR', error.message);
  }
}

function cadastrarTecnicoManutencao(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    if (!isActiveAdmin_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem cadastrar tecnicos.');
    }

    const nome = String(data.nome || '').trim();
    const email = normalizeEmail_(data.email);
    const telefone = String(data.telefone || '').trim();
    const especialidade = String(data.especialidade || '').trim();

    if (!nome) {
      return accessError_('NOME_TECNICO_OBRIGATORIO', 'Informe o nome do tecnico.');
    }

    if (email && !isUelEmail_(email)) {
      return accessError_('EMAIL_TECNICO_INVALIDO', 'Use um e-mail institucional @uel.br ou deixe em branco.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getTecnicosSheet_(spreadsheet);
    const existing = email ? findTecnicoRowByEmail_(sheet, email) : null;
    const now = now_();

    if (existing) {
      const index = headerIndex_(existing.headers);
      sheet.getRange(existing.rowNumber, index.nome + 1).setValue(nome);
      sheet.getRange(existing.rowNumber, index.telefone + 1).setValue(telefone);
      sheet.getRange(existing.rowNumber, index.especialidade + 1).setValue(especialidade);
      sheet.getRange(existing.rowNumber, index.ativo + 1).setValue(true);
      sheet.getRange(existing.rowNumber, index.updated_at + 1).setValue(now);
      appendSecurityLog_('CADASTRAR_TECNICO', 'Tecnico atualizado/reativado.', 'TECNICO', existing.values[index.id] || email, {
        tecnico_email: email,
        atualizado_por: admin.email || ''
      });
      return success_(buildTecnicoFromValues_(existing.headers, sheet.getRange(existing.rowNumber, 1, 1, existing.headers.length).getValues()[0]));
    }

    const tecnicoId = 'TEC-' + Utilities.getUuid();
    sheet.appendRow([
      tecnicoId,
      nome,
      email,
      telefone,
      especialidade,
      true,
      now,
      now
    ]);
    appendSecurityLog_('CADASTRAR_TECNICO', 'Tecnico cadastrado.', 'TECNICO', tecnicoId, {
      tecnico_email: email,
      cadastrado_por: admin.email || ''
    });

    return success_({
      id: tecnicoId,
      nome: nome,
      email: email,
      telefone: telefone,
      especialidade: especialidade,
      ativo: true,
      created_at: now,
      updated_at: now
    });
  } catch (error) {
    return accessError_('CADASTRAR_TECNICO_ERROR', error.message);
  }
}

function atribuirChamadoManutencao(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    if (!isActiveAdmin_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem encaminhar chamados.');
    }

    const chamadoId = String(data.chamado_id || data.id || '').trim();
    const tecnicoId = String(data.tecnico_id || '').trim();
    const observacao = String(data.observacao || '').trim();

    if (!chamadoId) {
      return accessError_('CHAMADO_ID_OBRIGATORIO', 'Informe o chamado para encaminhar.');
    }

    if (!tecnicoId) {
      return accessError_('TECNICO_ID_OBRIGATORIO', 'Selecione um tecnico de manutencao.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const tecnico = getTecnicoById_(spreadsheet, tecnicoId);
    if (!tecnico) {
      return accessError_('TECNICO_NAO_ENCONTRADO', 'Tecnico de manutencao nao encontrado ou inativo.');
    }

    const sheet = spreadsheet.getSheetByName('chamados');
    const location = findRowById_(sheet, chamadoId);
    if (!location) {
      return accessError_('CHAMADO_NAO_ENCONTRADO', 'Chamado nao encontrado.');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const index = headerIndex_(headers);
    const row = sheet.getRange(location.rowNumber, 1, 1, headers.length).getValues()[0];
    const statusAnterior = String(row[index.status] || '').trim().toUpperCase();
    const now = now_();

    sheet.getRange(location.rowNumber, index.executante_id + 1).setValue(tecnico.id);
    sheet.getRange(location.rowNumber, index.status + 1).setValue('ENCAMINHADO');
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);

    appendHistoricoChamado_(
      spreadsheet,
      chamadoId,
      admin.id || admin.email || '',
      'ENCAMINHAMENTO_MANUTENCAO',
      statusAnterior,
      'ENCAMINHADO',
      'Encaminhado para ' + tecnico.nome + (observacao ? '. ' + observacao : '.')
    );
    appendSecurityLog_('ENCAMINHAR_MANUTENCAO', 'Chamado encaminhado para manutencao.', 'CHAMADO', chamadoId, {
      tecnico_id: tecnico.id,
      tecnico_nome: tecnico.nome,
      encaminhado_por: admin.email || ''
    });

    return success_({
      id: chamadoId,
      tecnico: tecnico,
      status: 'ENCAMINHADO',
      status_anterior: statusAnterior,
      updated_at: now
    });
  } catch (error) {
    return accessError_('ATRIBUIR_CHAMADO_ERROR', error.message);
  }
}

function inativarTecnicoManutencao(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    if (!isActiveAdmin_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem inativar tecnicos.');
    }

    const tecnicoId = String(data.tecnico_id || '').trim();
    if (!tecnicoId) {
      return accessError_('TECNICO_ID_OBRIGATORIO', 'Informe o tecnico para inativar.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getTecnicosSheet_(spreadsheet);
    const location = findTecnicoRowById_(sheet, tecnicoId);
    if (!location) {
      return accessError_('TECNICO_NAO_ENCONTRADO', 'Tecnico nao encontrado.');
    }

    const index = headerIndex_(location.headers);
    const now = now_();
    sheet.getRange(location.rowNumber, index.ativo + 1).setValue(false);
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);
    appendSecurityLog_('INATIVAR_TECNICO', 'Tecnico inativado.', 'TECNICO', tecnicoId, {
      inativado_por: admin.email || ''
    });

    return success_({
      id: tecnicoId,
      ativo: false,
      updated_at: now
    });
  } catch (error) {
    return accessError_('INATIVAR_TECNICO_ERROR', error.message);
  }
}

function getTecnicosAtivos_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = getTecnicosSheet_(spreadsheet);
  return readSheetObjects_(sheet)
    .filter(function(row) {
      return String(row.ativo).toUpperCase() === 'TRUE' || row.ativo === true;
    })
    .map(function(row) {
      return {
        id: row.id || '',
        nome: row.nome || '',
        email: row.email || '',
        telefone: row.telefone || '',
        especialidade: row.especialidade || '',
        ativo: row.ativo,
        created_at: row.created_at || '',
        updated_at: row.updated_at || ''
      };
    })
    .sort(function(a, b) {
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
}

function getTecnicoById_(spreadsheet, tecnicoId) {
  const sheet = getTecnicosSheet_(spreadsheet);
  const rows = readSheetObjects_(sheet);
  const target = String(tecnicoId || '').trim();

  for (var i = 0; i < rows.length; i++) {
    const active = String(rows[i].ativo).toUpperCase() === 'TRUE' || rows[i].ativo === true;
    if (active && String(rows[i].id || '').trim() === target) {
      return {
        id: rows[i].id || '',
        nome: rows[i].nome || '',
        email: rows[i].email || '',
        telefone: rows[i].telefone || '',
        especialidade: rows[i].especialidade || ''
      };
    }
  }

  return null;
}

function getTecnicosSheet_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('tecnicos') || spreadsheet.insertSheet('tecnicos');
  ensureHeaders_(sheet, TECNICOS_SCHEMA);
  return sheet;
}

function findTecnicoRowByEmail_(sheet, email) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const normalized = normalizeEmail_(email);

  for (var i = 0; i < values.length; i++) {
    if (normalizeEmail_(values[i][index.email]) === normalized) {
      return {
        rowNumber: i + 2,
        headers: headers,
        values: values[i]
      };
    }
  }

  return null;
}

function findTecnicoRowById_(sheet, tecnicoId) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const target = String(tecnicoId || '').trim();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][index.id] || '').trim() === target) {
      return {
        rowNumber: i + 2,
        headers: headers,
        values: values[i]
      };
    }
  }

  return null;
}

function buildTecnicoFromValues_(headers, values) {
  const index = headerIndex_(headers);
  return {
    id: values[index.id] || '',
    nome: values[index.nome] || '',
    email: values[index.email] || '',
    telefone: values[index.telefone] || '',
    especialidade: values[index.especialidade] || '',
    ativo: values[index.ativo],
    created_at: values[index.created_at] || '',
    updated_at: values[index.updated_at] || ''
  };
}

function isActiveAdmin_(user) {
  const active = user && (String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true);
  return active && canManageAccess_(user);
}
