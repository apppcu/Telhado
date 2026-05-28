function listarChamados() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return getChamadosDashboard_(spreadsheet);
}

function criarChamado(payload) {
  try {
    const data = payload || {};
    const email = getAccessEmailFromPayload_(data);
    const user = getAuthorizedUserFromPayload_(data);

    if (!user || !(String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true)) {
      return accessError_('USUARIO_NAO_AUTORIZADO', 'Usuario nao autorizado para abrir chamados.');
    }

    const centroSigla = String(data.centro_sigla || user.centro_sigla || '').trim().toUpperCase();
    const predioId = String(data.predio_id || '').trim();
    const descricao = String(data.descricao || '').trim();
    const categoria = String(data.categoria || 'VAZAMENTO').trim().toUpperCase();
    const prioridade = String(data.prioridade || 'NORMAL').trim().toUpperCase();
    const observacao = String(data.observacao || '').trim();

    if (!centroSigla || !centroExists_(centroSigla)) {
      return accessError_('CENTRO_INVALIDO', 'Selecione um centro valido.');
    }

    if (!descricao) {
      return accessError_('DESCRICAO_OBRIGATORIA', 'Informe a descricao do chamado.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('chamados');
    const duplicate = findDuplicateOpenChamado_(sheet, [user.id, email], centroSigla, predioId, categoria, descricao);

    if (duplicate) {
      return accessError_(
        'CHAMADO_DUPLICADO',
        'Este pedido ja esta sendo verificado pelo setor de manutencao' +
          (duplicate.numero ? ' no chamado ' + duplicate.numero : '') +
          '.'
      );
    }

    const now = now_();
    const chamadoId = 'CHAM-' + Utilities.getUuid();
    const numero = nextChamadoNumero_(sheet);

    sheet.appendRow([
      chamadoId,
      numero,
      predioId,
      centroSigla,
      user.id || email,
      descricao,
      categoria,
      prioridade,
      'ABERTO',
      '',
      now,
      '',
      observacao,
      now,
      now
    ]);

    appendHistoricoChamado_(spreadsheet, chamadoId, user.id || email, 'ABERTURA', '', 'ABERTO', 'Chamado aberto pelo painel web.');

    return success_({
      id: chamadoId,
      numero: numero,
      predio_id: predioId,
      centro_sigla: centroSigla,
      descricao: descricao,
      categoria: categoria,
      prioridade: prioridade,
      status: 'ABERTO',
      data_abertura: now
    });
  } catch (error) {
    return accessError_('CRIAR_CHAMADO_ERROR', error.message);
  }
}

function getHistoricoChamado(chamadoId, payload) {
  try {
    const id = String(chamadoId || '').trim();
    if (!id) {
      return accessError_('CHAMADO_ID_OBRIGATORIO', 'Informe o chamado para consultar historico.');
    }

    const user = getAuthorizedUserFromPayload_(payload);
    if (!user || !(String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true)) {
      return accessError_('USUARIO_NAO_AUTORIZADO', 'Usuario nao autorizado para consultar historico.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('historico_chamado');
    const rows = readSheetObjects_(sheet);
    const historico = rows
      .filter(function(row) {
        return String(row.chamado_id || '').trim() === id;
      })
      .map(function(row) {
        return {
          id: row.id || '',
          chamado_id: row.chamado_id || '',
          usuario_id: row.usuario_id || '',
          acao: row.acao || '',
          origem: row.origem || '',
          status_anterior: row.status_anterior || '',
          status_novo: row.status_novo || '',
          observacao: row.observacao || '',
          created_at: row.created_at || ''
        };
      })
      .sort(function(a, b) {
        return dateValue_(a.created_at) - dateValue_(b.created_at);
      });

    return success_(historico);
  } catch (error) {
    return accessError_('HISTORICO_CHAMADO_ERROR', error.message);
  }
}

function atualizarChamado(item) {
  try {
    const data = item || {};
    const chamadoId = String(data.id || '').trim();
    const novoStatus = String(data.status || '').trim().toUpperCase();
    const observacao = String(data.observacao || '').trim();
    const allowedStatus = ['ABERTO', 'EM_ANALISE', 'ENCAMINHADO', 'EM_EXECUCAO', 'CONCLUIDO'];

    if (!chamadoId) {
      return accessError_('CHAMADO_ID_OBRIGATORIO', 'Informe o chamado para atualizar.');
    }

    if (allowedStatus.indexOf(novoStatus) < 0) {
      return accessError_('STATUS_INVALIDO', 'Selecione um status valido.');
    }

    const email = getAccessEmailFromPayload_(data);
    const user = getAuthorizedUserFromPayload_(data);
    if (!user || !(String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true)) {
      return accessError_('USUARIO_NAO_AUTORIZADO', 'Usuario nao autorizado para atualizar chamados.');
    }

    if (!canManageAccess_(user)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem alterar status de chamados.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
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

    sheet.getRange(location.rowNumber, index.status + 1).setValue(novoStatus);
    sheet.getRange(location.rowNumber, index.observacao + 1).setValue(observacao || row[index.observacao] || '');
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);

    if (novoStatus === 'CONCLUIDO' && index.data_fechamento >= 0 && !row[index.data_fechamento]) {
      sheet.getRange(location.rowNumber, index.data_fechamento + 1).setValue(now);
    }

    appendHistoricoChamado_(
      spreadsheet,
      chamadoId,
      user.id || email,
      'ALTERACAO_STATUS',
      statusAnterior,
      novoStatus,
      observacao || 'Status atualizado pelo painel web.'
    );
    appendSecurityLog_('ATUALIZAR_CHAMADO', 'Status de chamado atualizado.', 'CHAMADO', chamadoId, {
      usuario_id: user.id || email,
      status_anterior: statusAnterior,
      status_novo: novoStatus
    });

    return success_({
      id: chamadoId,
      status: novoStatus,
      status_anterior: statusAnterior,
      updated_at: now
    });
  } catch (error) {
    return accessError_('ATUALIZAR_CHAMADO_ERROR', error.message);
  }
}

function nextChamadoNumero_(sheet) {
  const prefix = 'CH-';
  const digits = 6;
  const lastRow = sheet.getLastRow();
  let maxNumber = 0;

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    values.forEach(function(row) {
      const raw = String(row[0] || '');
      const number = Number(raw.replace(/\D/g, ''));
      if (!isNaN(number)) {
        maxNumber = Math.max(maxNumber, number);
      }
    });
  }

  return prefix + String(maxNumber + 1).padStart(digits, '0');
}

function findDuplicateOpenChamado_(sheet, solicitanteIds, centroSigla, predioId, categoria, descricao) {
  const activeStatus = ['ABERTO', 'EM_ANALISE', 'ENCAMINHADO', 'EM_EXECUCAO'];
  const rows = readSheetObjects_(sheet);
  const targetSolicitantes = solicitanteIds
    .map(function(value) {
      return normalizeDuplicateText_(value);
    })
    .filter(function(value) {
      return value;
    });
  const targetCentro = normalizeDuplicateText_(centroSigla);
  const targetPredio = normalizeDuplicateText_(predioId);
  const targetCategoria = normalizeDuplicateText_(categoria);
  const targetDescricao = normalizeDuplicateText_(descricao);

  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const status = normalizeDuplicateText_(row.status);

    if (activeStatus.indexOf(status) < 0) {
      continue;
    }

    if (
      targetSolicitantes.indexOf(normalizeDuplicateText_(row.solicitante_id)) >= 0 &&
      normalizeDuplicateText_(row.centro_sigla) === targetCentro &&
      normalizeDuplicateText_(row.predio_id) === targetPredio &&
      normalizeDuplicateText_(row.categoria) === targetCategoria &&
      isDuplicateChamadoDescription_(targetPredio, targetDescricao, row.descricao)
    ) {
      return row;
    }
  }

  return null;
}

function isDuplicateChamadoDescription_(targetPredio, targetDescricao, existingDescricao) {
  if (targetPredio) {
    return true;
  }

  return normalizeDuplicateText_(existingDescricao) === targetDescricao;
}

function normalizeDuplicateText_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function appendHistoricoChamado_(spreadsheet, chamadoId, usuarioId, acao, statusAnterior, statusNovo, observacao) {
  const sheet = spreadsheet.getSheetByName('historico_chamado');
  if (!sheet) {
    return;
  }

  sheet.appendRow([
    'HIST-' + Utilities.getUuid(),
    chamadoId,
    usuarioId,
    acao,
    'WEB',
    statusAnterior,
    statusNovo,
    observacao,
    now_()
  ]);
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === id) {
      return {
        rowNumber: i + 2
      };
    }
  }

  return null;
}

