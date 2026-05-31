function listarChamados() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return getChamadosDashboard_(spreadsheet);
}

function listarChamadosTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const token = String(data.token || '').trim();

    if (!token) {
      return accessError_('TOKEN_OBRIGATORIO', 'Sessao invalida. Entre novamente.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const tecnicosSheet = getTecnicosSheet_(spreadsheet);
    const tecnicoLocation = findTecnicoRowByToken_(tecnicosSheet, token);

    if (!tecnicoLocation) {
      return accessError_('SESSAO_INVALIDA', 'Sessao expirada. Entre novamente.');
    }

    const tecnicoIndex = headerIndex_(tecnicoLocation.headers);
    const tecnicoRow = tecnicoLocation.values;
    const tecnicoAtivo = isTrue_(tecnicoRow[tecnicoIndex.ativo]);

    if (!tecnicoAtivo) {
      return accessError_('TECNICO_INATIVO', 'Tecnico inativo.');
    }

    const tecnicoId = String(tecnicoRow[tecnicoIndex.id] || '').trim();
    const chamadosSheet = spreadsheet.getSheetByName('chamados');
    const rows = readSheetObjects_(chamadosSheet);
    const prediosById = getPrediosByIdForChamadosMobile_(spreadsheet);

    const chamados = rows
      .filter(function(row) {
        const status = String(row.status || '').trim().toUpperCase();
        return String(row.executante_id || '').trim() === tecnicoId && status !== 'CONCLUIDO';
      })
      .map(function(row) {
        return buildChamadoMobileResponse_(
          spreadsheet,
          row,
          null,
          row.id || '',
          row.status || 'ENCAMINHADO',
          undefined,
          row.updated_at || '',
          prediosById
        );
      })
      .sort(function(a, b) {
        return dateValue_(b.data_abertura) - dateValue_(a.data_abertura);
      });

    return success_({
      tecnico: {
        id: tecnicoId,
        nome: tecnicoRow[tecnicoIndex.nome] || '',
        login: tecnicoRow[tecnicoIndex.login] || ''
      },
      chamados: chamados
    });
  } catch (error) {
    return accessError_('LISTAR_CHAMADOS_TECNICO_ERROR', error.message);
  }
}

function iniciarVistoriaTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const context = getChamadoTecnicoMobileContext_(data, 'iniciar a vistoria');
    if (!context.ok) {
      return context.error;
    }

    const statusAnterior = String(context.row[context.index.status] || '').trim().toUpperCase();
    const allowedStatus = ['ABERTO', 'ENCAMINHADO', 'EM_ANALISE'];

    if (allowedStatus.indexOf(statusAnterior) < 0) {
      return accessError_('STATUS_INVALIDO_PARA_VISTORIA', 'A vistoria so pode ser iniciada em chamados atribuidos ao tecnico.');
    }

    const now = now_();
    if (statusAnterior !== 'EM_ANALISE') {
      context.sheet.getRange(context.location.rowNumber, context.index.status + 1).setValue('EM_ANALISE');
      context.sheet.getRange(context.location.rowNumber, context.index.updated_at + 1).setValue(now);
      registrarLocalizacaoChamadoMobile_(context.spreadsheet, context.chamadoId, context.tecnicoId, 'INICIO_VISTORIA', data);
      appendHistoricoChamado_(
        context.spreadsheet,
        context.chamadoId,
        context.tecnicoId,
        'INICIO_VISTORIA',
        statusAnterior,
        'EM_ANALISE',
        appendObservacaoBloco_(
          'Vistoria iniciada pelo aplicativo mobile.',
          buildLocalizacaoResumoMobile_(data)
        ),
        'MOBILE'
      );
      appendSecurityLog_('INICIAR_VISTORIA_MOBILE', 'Vistoria iniciada pelo aplicativo mobile.', 'CHAMADO', context.chamadoId, {
        tecnico_id: context.tecnicoId,
        status_anterior: statusAnterior,
        status_novo: 'EM_ANALISE'
      });
    }

    return success_(buildChamadoMobileResponse_(
      context.spreadsheet,
      context.row,
      context.index,
      context.chamadoId,
      'EM_ANALISE',
      statusAnterior,
      now
    ));
  } catch (error) {
    return accessError_('INICIAR_VISTORIA_ERROR', error.message);
  }
}

function salvarVistoriaTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const observacaoTecnica = String(data.observacao_tecnica || '').trim();
    const materiais = String(data.materiais || '').trim();
    const ferramentas = String(data.ferramentas || '').trim();
    const resolverNaHora = isTrue_(data.resolver_na_hora);
    const vistoriaToken = String(data.vistoria_token || '').trim();

    const context = getChamadoTecnicoMobileContext_(data, 'salvar a vistoria');
    if (!context.ok) {
      return context.error;
    }

    const statusAnterior = String(context.row[context.index.status] || '').trim().toUpperCase();
    if (statusAnterior !== 'EM_ANALISE') {
      return accessError_('STATUS_INVALIDO_PARA_SALVAR_VISTORIA', 'A vistoria so pode ser salva em chamados em analise.');
    }

    const novoStatus = resolverNaHora ? 'EM_EXECUCAO' : 'EM_ANALISE';
    const now = now_();
    const resumoVistoria = appendObservacaoBloco_(
      buildResumoVistoriaMobile_(observacaoTecnica, materiais, ferramentas, resolverNaHora),
      buildLocalizacaoResumoMobile_(data)
    );
    const observacaoAtual = String(context.row[context.index.observacao] || '').trim();
    const observacaoFinal = appendObservacaoBloco_(observacaoAtual, resumoVistoria);

    context.sheet.getRange(context.location.rowNumber, context.index.status + 1).setValue(novoStatus);
    context.sheet.getRange(context.location.rowNumber, context.index.observacao + 1).setValue(observacaoFinal);
    context.sheet.getRange(context.location.rowNumber, context.index.updated_at + 1).setValue(now);
    registrarLocalizacaoChamadoMobile_(context.spreadsheet, context.chamadoId, context.tecnicoId, 'VISTORIA_REGISTRADA', data);

    appendHistoricoChamado_(
      context.spreadsheet,
      context.chamadoId,
      context.tecnicoId,
      'VISTORIA_REGISTRADA',
      statusAnterior,
      novoStatus,
      resumoVistoria,
      'MOBILE'
    );
    appendSecurityLog_('SALVAR_VISTORIA_MOBILE', 'Vistoria salva pelo aplicativo mobile.', 'CHAMADO', context.chamadoId, {
      tecnico_id: context.tecnicoId,
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      resolver_na_hora: resolverNaHora
    });
    registrarPecasVistoria_(
      context.spreadsheet,
      context,
      {
        observacao_tecnica: observacaoTecnica,
        materiais: materiais,
        ferramentas: ferramentas,
        resumo_vistoria: resumoVistoria,
        vistoria_token: vistoriaToken
      },
      now
    );

    const response = buildChamadoMobileResponse_(
      context.spreadsheet,
      context.row,
      context.index,
      context.chamadoId,
      novoStatus,
      statusAnterior,
      now
    );
    response.observacao = observacaoFinal;
    response.observacao_tecnica = observacaoTecnica;
    response.materiais = materiais;
    response.ferramentas = ferramentas;
    response.resolver_na_hora = resolverNaHora;
    return success_(response);
  } catch (error) {
    return accessError_('SALVAR_VISTORIA_ERROR', error.message);
  }
}

function iniciarReparoTecnicoMobile(payload) {
  try {
    const context = getChamadoTecnicoMobileContext_(payload, 'iniciar o reparo');
    if (!context.ok) {
      return context.error;
    }

    const statusAnterior = String(context.row[context.index.status] || '').trim().toUpperCase();
    if (statusAnterior !== 'EM_ANALISE') {
      return accessError_('STATUS_INVALIDO_PARA_INICIAR_REPARO', 'O reparo so pode ser iniciado apos a vistoria.');
    }

    const now = now_();
    context.sheet.getRange(context.location.rowNumber, context.index.status + 1).setValue('EM_EXECUCAO');
    context.sheet.getRange(context.location.rowNumber, context.index.updated_at + 1).setValue(now);
    registrarLocalizacaoChamadoMobile_(context.spreadsheet, context.chamadoId, context.tecnicoId, 'INICIO_REPARO', payload);

    appendHistoricoChamado_(
      context.spreadsheet,
      context.chamadoId,
      context.tecnicoId,
      'INICIO_REPARO',
      statusAnterior,
      'EM_EXECUCAO',
      appendObservacaoBloco_(
        'Reparo iniciado pelo aplicativo mobile.',
        buildLocalizacaoResumoMobile_(payload)
      ),
      'MOBILE'
    );
    appendSecurityLog_('INICIAR_REPARO_MOBILE', 'Reparo iniciado pelo aplicativo mobile.', 'CHAMADO', context.chamadoId, {
      tecnico_id: context.tecnicoId,
      status_anterior: statusAnterior,
      status_novo: 'EM_EXECUCAO'
    });

    return success_(buildChamadoMobileResponse_(context.spreadsheet, context.row, context.index, context.chamadoId, 'EM_EXECUCAO', statusAnterior, now));
  } catch (error) {
    return accessError_('INICIAR_REPARO_ERROR', error.message);
  }
}

function reabrirVistoriaTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const justificativa = String(data.justificativa || '').trim();

    if (!justificativa) {
      return accessError_('JUSTIFICATIVA_OBRIGATORIA', 'Explique por que uma nova vistoria e necessaria.');
    }

    const context = getChamadoTecnicoMobileContext_(payload, 'abrir nova vistoria');
    if (!context.ok) {
      return context.error;
    }

    const statusAnterior = String(context.row[context.index.status] || '').trim().toUpperCase();
    if (statusAnterior === 'EM_ANALISE') {
      const response = buildChamadoMobileResponse_(
        context.spreadsheet,
        context.row,
        context.index,
        context.chamadoId,
        'EM_ANALISE',
        statusAnterior,
        context.row[context.index.updated_at] || now_()
      );
      response.observacao = String(context.row[context.index.observacao] || '').trim();
      response.nova_vistoria_ja_aberta = true;
      return success_(response);
    }

    if (statusAnterior !== 'EM_EXECUCAO') {
      return accessError_('STATUS_INVALIDO_PARA_NOVA_VISTORIA', 'A nova vistoria so pode ser aberta durante a execucao.');
    }

    const now = now_();
    const observacaoAtual = String(context.row[context.index.observacao] || '').trim();
    const observacaoNovaVistoria = appendObservacaoBloco_(
      'Nova vistoria: ' + justificativa,
      buildLocalizacaoResumoMobile_(data)
    );
    const observacao = appendObservacaoBloco_(observacaoAtual, observacaoNovaVistoria);

    context.sheet.getRange(context.location.rowNumber, context.index.status + 1).setValue('EM_ANALISE');
    context.sheet.getRange(context.location.rowNumber, context.index.observacao + 1).setValue(observacao);
    context.sheet.getRange(context.location.rowNumber, context.index.updated_at + 1).setValue(now);
    registrarLocalizacaoChamadoMobile_(context.spreadsheet, context.chamadoId, context.tecnicoId, 'NOVA_VISTORIA', data);

    appendHistoricoChamado_(
      context.spreadsheet,
      context.chamadoId,
      context.tecnicoId,
      'NOVA_VISTORIA',
      statusAnterior,
      'EM_ANALISE',
      observacaoNovaVistoria,
      'MOBILE'
    );
    appendSecurityLog_('NOVA_VISTORIA_MOBILE', 'Nova vistoria aberta pelo aplicativo mobile.', 'CHAMADO', context.chamadoId, {
      tecnico_id: context.tecnicoId,
      status_anterior: statusAnterior,
      status_novo: 'EM_ANALISE'
    });

    const response = buildChamadoMobileResponse_(context.spreadsheet, context.row, context.index, context.chamadoId, 'EM_ANALISE', statusAnterior, now);
    response.observacao = observacao;
    return success_(response);
  } catch (error) {
    return accessError_('NOVA_VISTORIA_ERROR', error.message);
  }
}

function concluirReparoTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const servicoExecutado = String(data.servico_executado || '').trim();
    const observacaoFinal = String(data.observacao_final || '').trim();

    const context = getChamadoTecnicoMobileContext_(payload, 'concluir o reparo');
    if (!context.ok) {
      return context.error;
    }

    const statusAnterior = String(context.row[context.index.status] || '').trim().toUpperCase();
    if (statusAnterior === 'CONCLUIDO') {
      const response = buildChamadoMobileResponse_(
        context.spreadsheet,
        context.row,
        context.index,
        context.chamadoId,
        'CONCLUIDO',
        statusAnterior,
        context.row[context.index.updated_at] || now_()
      );
      response.servico_executado = servicoExecutado;
      response.observacao_final = observacaoFinal;
      response.encerramento_ja_sincronizado = true;
      return success_(response);
    }

    const allowedStatus = ['ENCAMINHADO', 'EM_ANALISE', 'EM_EXECUCAO'];
    if (allowedStatus.indexOf(statusAnterior) < 0) {
      return accessError_('STATUS_INVALIDO_PARA_CONCLUIR_REPARO', 'O reparo nao pode ser concluido no status atual.');
    }

    const now = now_();
    const resumo = appendObservacaoBloco_(
      buildResumoConclusaoMobile_(servicoExecutado, observacaoFinal),
      buildLocalizacaoResumoMobile_(data)
    );
    const observacaoAtual = String(context.row[context.index.observacao] || '').trim();
    const observacao = appendObservacaoBloco_(observacaoAtual, resumo);

    context.sheet.getRange(context.location.rowNumber, context.index.status + 1).setValue('CONCLUIDO');
    context.sheet.getRange(context.location.rowNumber, context.index.observacao + 1).setValue(observacao);
    context.sheet.getRange(context.location.rowNumber, context.index.updated_at + 1).setValue(now);
    if (context.index.data_fechamento >= 0) {
      context.sheet.getRange(context.location.rowNumber, context.index.data_fechamento + 1).setValue(now);
    }
    registrarLocalizacaoChamadoMobile_(context.spreadsheet, context.chamadoId, context.tecnicoId, 'REPARO_CONCLUIDO', data);

    appendHistoricoChamado_(
      context.spreadsheet,
      context.chamadoId,
      context.tecnicoId,
      'REPARO_CONCLUIDO',
      statusAnterior,
      'CONCLUIDO',
      resumo,
      'MOBILE'
    );
    appendSecurityLog_('CONCLUIR_REPARO_MOBILE', 'Reparo concluido pelo aplicativo mobile.', 'CHAMADO', context.chamadoId, {
      tecnico_id: context.tecnicoId,
      status_anterior: statusAnterior,
      status_novo: 'CONCLUIDO'
    });

    const response = buildChamadoMobileResponse_(context.spreadsheet, context.row, context.index, context.chamadoId, 'CONCLUIDO', statusAnterior, now);
    response.observacao = observacao;
    response.servico_executado = servicoExecutado;
    response.observacao_final = observacaoFinal;
    response.data_fechamento = now;
    return success_(response);
  } catch (error) {
    return accessError_('CONCLUIR_REPARO_ERROR', error.message);
  }
}

function criarChamado(payload) {
  try {
    const data = payload || {};
    const email = getAccessEmailFromPayload_(data);
    const user = getAuthorizedUserFromPayload_(data);

    if (!user || !isTrue_(user.ativo)) {
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
    if (!user || !isTrue_(user.ativo)) {
      return accessError_('USUARIO_NAO_AUTORIZADO', 'Usuario nao autorizado para consultar historico.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('historico_chamado');
    const rows = readSheetObjects_(sheet);
    const usersByReference = getUsuariosByReferenceForHistorico_(spreadsheet);
    const tecnicosByReference = getTecnicosByReferenceForHistorico_(spreadsheet);
    const historico = rows
      .filter(function(row) {
        return String(row.chamado_id || '').trim() === id;
      })
      .map(function(row) {
        const usuarioId = row.usuario_id || '';
        const pessoa = usersByReference[String(usuarioId).trim()] || tecnicosByReference[String(usuarioId).trim()] || null;
        return {
          id: row.id || '',
          chamado_id: row.chamado_id || '',
          usuario_id: usuarioId,
          usuario_nome: pessoa ? pessoa.nome : '',
          usuario_email: pessoa ? pessoa.email : '',
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
    if (!user || !isTrue_(user.ativo)) {
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

function getPrediosByIdForChamadosMobile_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('predios');
  if (!sheet) {
    return {};
  }

  return readSheetObjects_(sheet).reduce(function(map, predio) {
    const id = String(predio.id || '').trim();
    if (id) {
      map[id] = {
        id: id,
        nome: predio.nome || '',
        centro_sigla: predio.centro_sigla || ''
      };
    }
    return map;
  }, {});
}

function buildResumoVistoriaMobile_(observacaoTecnica, materiais, ferramentas, resolverNaHora) {
  const parts = [];

  if (observacaoTecnica) {
    parts.push('Vistoria tecnica: ' + observacaoTecnica);
  }

  if (materiais) {
    parts.push('Materiais necessarios: ' + materiais);
  }

  if (ferramentas) {
    parts.push('Ferramentas/equipe necessaria: ' + ferramentas);
  }

  parts.push('Resolver na hora: ' + (resolverNaHora ? 'SIM' : 'NAO'));
  if (parts.length === 1) {
    parts.unshift('Vistoria registrada pelo aplicativo mobile.');
  }

  return parts.join('\n');
}

function buildResumoConclusaoMobile_(servicoExecutado, observacaoFinal) {
  const parts = [];

  if (servicoExecutado) {
    parts.push('Servico executado: ' + servicoExecutado);
  }

  if (observacaoFinal) {
    parts.push('Observacao final: ' + observacaoFinal);
  }

  if (parts.length === 0) {
    parts.push('Servico encerrado pelo aplicativo mobile.');
  }

  return parts.join('\n');
}

function appendObservacaoBloco_(observacaoAtual, novoBloco) {
  const atual = String(observacaoAtual || '').trim();
  const bloco = String(novoBloco || '').trim();

  if (!atual) {
    return bloco;
  }

  if (!bloco) {
    return atual;
  }

  return atual + '\n\n' + bloco;
}

function buildLocalizacaoResumoMobile_(data) {
  const payload = data || {};
  const localizacao = payload.localizacao || {};

  if (localizacao.gps_disponivel === true) {
    const latitude = localizacao.latitude;
    const longitude = localizacao.longitude;
    const precisao = localizacao.precisao_metros;
    const capturadoEm = localizacao.gps_capturado_em || '';
    return 'Localizacao GPS: ' + latitude + ', ' + longitude +
      (precisao !== '' && precisao !== null && precisao !== undefined ? ' (precisao ' + precisao + 'm)' : '') +
      (capturadoEm ? '\nGPS capturado em: ' + capturadoEm : '');
  }

  if (localizacao.gps_disponivel === false) {
    return 'Localizacao GPS indisponivel: ' + (localizacao.gps_motivo || 'motivo nao informado') +
      (localizacao.gps_capturado_em ? '\nGPS verificado em: ' + localizacao.gps_capturado_em : '');
  }

  return '';
}

function registrarLocalizacaoChamadoMobile_(spreadsheet, chamadoId, usuarioId, acao, data) {
  const payload = data || {};
  const localizacao = payload.localizacao || {};
  const hasLocationPayload =
    localizacao.gps_disponivel === true || localizacao.gps_disponivel === false;

  if (!hasLocationPayload) {
    return;
  }

  let sheet = spreadsheet.getSheetByName('gps_chamado');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('gps_chamado');
    ensureHeaders_(sheet, [
      'id',
      'chamado_id',
      'usuario_id',
      'acao',
      'origem',
      'gps_disponivel',
      'latitude',
      'longitude',
      'precisao_metros',
      'gps_capturado_em',
      'gps_motivo',
      'created_at'
    ]);
  }

  sheet.appendRow([
    'GPS-' + Utilities.getUuid(),
    chamadoId || '',
    usuarioId || '',
    acao || '',
    'MOBILE',
    localizacao.gps_disponivel === true,
    localizacao.latitude || '',
    localizacao.longitude || '',
    localizacao.precisao_metros || '',
    localizacao.gps_capturado_em || '',
    localizacao.gps_motivo || '',
    now_()
  ]);
}

function getChamadoTecnicoMobileContext_(payload, actionLabel) {
  const data = payload || {};
  const token = String(data.token || '').trim();
  const chamadoId = String(data.chamado_id || data.id || '').trim();

  if (!token) {
    return {
      ok: false,
      error: accessError_('TOKEN_OBRIGATORIO', 'Sessao invalida. Entre novamente.')
    };
  }

  if (!chamadoId) {
    return {
      ok: false,
      error: accessError_('CHAMADO_ID_OBRIGATORIO', 'Informe o chamado para ' + actionLabel + '.')
    };
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const tecnicosSheet = getTecnicosSheet_(spreadsheet);
  const tecnicoLocation = findTecnicoRowByToken_(tecnicosSheet, token);

  if (!tecnicoLocation) {
    return {
      ok: false,
      error: accessError_('SESSAO_INVALIDA', 'Sessao expirada. Entre novamente.')
    };
  }

  const tecnicoIndex = headerIndex_(tecnicoLocation.headers);
  const tecnicoRow = tecnicoLocation.values;
  const tecnicoAtivo = isTrue_(tecnicoRow[tecnicoIndex.ativo]);

  if (!tecnicoAtivo) {
    return {
      ok: false,
      error: accessError_('TECNICO_INATIVO', 'Tecnico inativo.')
    };
  }

  const tecnicoId = String(tecnicoRow[tecnicoIndex.id] || '').trim();
  const sheet = spreadsheet.getSheetByName('chamados');
  const location = findRowById_(sheet, chamadoId);

  if (!location) {
    return {
      ok: false,
      error: accessError_('CHAMADO_NAO_ENCONTRADO', 'Chamado nao encontrado.')
    };
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const row = sheet.getRange(location.rowNumber, 1, 1, headers.length).getValues()[0];
  const executanteId = String(row[index.executante_id] || '').trim();

  if (executanteId !== tecnicoId) {
    return {
      ok: false,
      error: accessError_('CHAMADO_NAO_ATRIBUIDO', 'Este chamado nao esta atribuido ao tecnico logado.')
    };
  }

  return {
    ok: true,
    spreadsheet: spreadsheet,
    sheet: sheet,
    location: location,
    headers: headers,
    index: index,
    row: row,
    chamadoId: chamadoId,
    tecnicoId: tecnicoId,
    tecnicoNome: String(tecnicoRow[tecnicoIndex.nome] || '').trim()
  };
}

function listarChamadosPecas(payload) {
  try {
    const user = getAuthorizedUserFromPayload_(payload);
    if (!user || !isTrue_(user.ativo) || !canManageAccess_(user)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem acessar o painel de pecas.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ensurePecasVistoriaSheet_(spreadsheet);
    const rows = readSheetObjects_(sheet);
    const itens = rows.length
      ? rows.map(mapPecaVistoriaRow_)
      : listarPecasFallbackDosChamados_(spreadsheet);
    const byChamado = {};

    itens.forEach(function(row) {
      const chamadoId = String(row.chamado_id || '').trim();
      if (!chamadoId) {
        return;
      }

      if (!byChamado[chamadoId]) {
        byChamado[chamadoId] = {
          chamado_id: chamadoId,
          chamado_numero: row.chamado_numero || chamadoId,
          centro_sigla: row.centro_sigla || '-',
          predio_id: row.predio_id || '-',
          predio_nome: row.predio_nome || '',
          total_vistorias: 0,
          pendentes: 0,
          ultima_vistoria_em: ''
        };
      }

      const item = byChamado[chamadoId];
      item.total_vistorias++;
      if (String(row.status_lista || 'PENDENTE').trim().toUpperCase() === 'PENDENTE') {
        item.pendentes++;
      }

      const currentDate = dateValue_(item.ultima_vistoria_em || '');
      const rowDate = dateValue_(row.vistoria_datahora || row.updated_at || row.created_at || '');
      if (rowDate >= currentDate) {
        item.ultima_vistoria_em = row.vistoria_datahora || row.updated_at || row.created_at || '';
      }
    });

    const chamados = Object.keys(byChamado)
      .map(function(key) {
        return byChamado[key];
      })
      .sort(function(a, b) {
        return dateValue_(b.ultima_vistoria_em) - dateValue_(a.ultima_vistoria_em);
      });

    return success_(chamados);
  } catch (error) {
    return accessError_('LISTAR_CHAMADOS_PECAS_ERROR', error.message);
  }
}

function listarPecasPorChamado(payload) {
  try {
    const data = payload || {};
    const user = getAuthorizedUserFromPayload_(data);
    if (!user || !isTrue_(user.ativo) || !canManageAccess_(user)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem acessar o painel de pecas.');
    }

    const chamadoId = String(data.chamado_id || '').trim();
    if (!chamadoId) {
      return accessError_('CHAMADO_ID_OBRIGATORIO', 'Selecione um chamado para listar as pecas.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ensurePecasVistoriaSheet_(spreadsheet);
    let rows = readSheetObjects_(sheet)
      .filter(function(row) {
        return String(row.chamado_id || '').trim() === chamadoId;
      })
      .map(mapPecaVistoriaRow_)
      .sort(function(a, b) {
        return a.vistoria_ordem - b.vistoria_ordem;
      });

    if (!rows.length) {
      rows = listarPecasFallbackDosChamados_(spreadsheet, chamadoId);
    }

    const resumo = rows.length ? {
      chamado_id: rows[0].chamado_id,
      chamado_numero: rows[0].chamado_numero,
      centro_sigla: rows[0].centro_sigla,
      predio_id: rows[0].predio_id,
      predio_nome: rows[0].predio_nome,
      total_vistorias: rows.length,
      pendentes: rows.filter(function(item) {
        return String(item.status_lista || '').toUpperCase() === 'PENDENTE';
      }).length
    } : null;

    return success_({
      resumo: resumo,
      itens: rows
    });
  } catch (error) {
    return accessError_('LISTAR_PECAS_CHAMADO_ERROR', error.message);
  }
}

function atualizarStatusPecaVistoria(payload) {
  try {
    const data = payload || {};
    const user = getAuthorizedUserFromPayload_(data);
    if (!user || !isTrue_(user.ativo) || !canManageAccess_(user)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem alterar status da lista de pecas.');
    }

    const itemId = String(data.item_id || '').trim();
    const statusLista = String(data.status_lista || '').trim().toUpperCase();
    const allowed = ['PENDENTE', 'EXPORTADO'];

    if (!itemId) {
      return accessError_('ITEM_ID_OBRIGATORIO', 'Selecione um item de pecas.');
    }

    if (allowed.indexOf(statusLista) < 0) {
      return accessError_('STATUS_LISTA_INVALIDO', 'Status de lista invalido.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ensurePecasVistoriaSheet_(spreadsheet);
    const location = findRowById_(sheet, itemId);
    if (!location) {
      return accessError_('ITEM_NAO_ENCONTRADO', 'Item de pecas nao encontrado.');
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const index = headerIndex_(headers);
    const now = now_();

    sheet.getRange(location.rowNumber, index.status_lista + 1).setValue(statusLista);
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);

    return success_({
      item_id: itemId,
      status_lista: statusLista,
      updated_at: now
    });
  } catch (error) {
    return accessError_('ATUALIZAR_STATUS_PECA_ERROR', error.message);
  }
}

function ensurePecasVistoriaSheet_(spreadsheet) {
  const headers = [
    'id',
    'chamado_id',
    'chamado_numero',
    'vistoria_numero',
    'vistoria_ordem',
    'vistoria_datahora',
    'centro_sigla',
    'predio_id',
    'predio_nome',
    'tecnico_id',
    'tecnico_nome',
    'materiais_texto',
    'observacao_tecnica',
    'status_lista',
    'origem_token',
    'created_at',
    'updated_at'
  ];
  let sheet = spreadsheet.getSheetByName('pecas_vistoria');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('pecas_vistoria');
  }

  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const current = lastColumn > 0 ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0] : [];
  let changed = false;

  headers.forEach(function(header, position) {
    if (String(current[position] || '').trim() !== header) {
      sheet.getRange(1, position + 1).setValue(header);
      changed = true;
    }
  });

  if (changed) {
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function registrarPecasVistoria_(spreadsheet, context, payload, now) {
  const data = payload || {};
  const token = String(data.vistoria_token || '').trim();
  const materiaisTexto = String(data.materiais || '').trim();
  const observacaoTecnica = String(data.observacao_tecnica || '').trim();
  const resumo = String(data.resumo_vistoria || '').trim();
  const materiaisFinal = materiaisTexto || resumo || 'Sem materiais informados na vistoria.';
  const timestamp = now || now_();

  const sheet = ensurePecasVistoriaSheet_(spreadsheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const row = context.row || [];
  const get = function(field) {
    return row[context.index[field]] || '';
  };

  if (token) {
    const existingByToken = findPecaVistoriaRowByToken_(sheet, token);
    if (existingByToken) {
      sheet.getRange(existingByToken.rowNumber, index.materiais_texto + 1).setValue(materiaisFinal);
      sheet.getRange(existingByToken.rowNumber, index.observacao_tecnica + 1).setValue(observacaoTecnica);
      sheet.getRange(existingByToken.rowNumber, index.updated_at + 1).setValue(timestamp);
      return;
    }
  }

  const ordem = nextVistoriaOrdemPecas_(sheet, context.chamadoId);
  const vistoriaNumero = 'V' + ordem;
  const itemId = 'PCV-' + Utilities.getUuid();

  sheet.appendRow([
    itemId,
    context.chamadoId,
    get('numero') || context.chamadoId,
    vistoriaNumero,
    ordem,
    timestamp,
    get('centro_sigla') || '',
    get('predio_nome') || get('predio_id') || '',
    get('predio_id') || '',
    context.tecnicoId || '',
    context.tecnicoNome || '',
    materiaisFinal,
    observacaoTecnica,
    'PENDENTE',
    token,
    timestamp,
    timestamp
  ]);
}

function nextVistoriaOrdemPecas_(sheet, chamadoId) {
  if (!sheet || sheet.getLastRow() < 2) {
    return 1;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const target = String(chamadoId || '').trim();
  let maxOrdem = 0;

  values.forEach(function(row) {
    if (String(row[index.chamado_id] || '').trim() !== target) {
      return;
    }
    const ordem = Number(row[index.vistoria_ordem] || 0);
    if (!isNaN(ordem) && ordem > maxOrdem) {
      maxOrdem = ordem;
    }
  });

  return maxOrdem + 1;
}

function findPecaVistoriaRowByToken_(sheet, token) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const target = String(token || '').trim();
  if (!target) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][index.origem_token] || '').trim() === target) {
      return {
        rowNumber: i + 2
      };
    }
  }

  return null;
}

function mapPecaVistoriaRow_(row) {
  const raw = row || {};
  return {
    id: raw.id || '',
    chamado_id: raw.chamado_id || '',
    chamado_numero: raw.chamado_numero || '',
    vistoria_numero: raw.vistoria_numero || '',
    vistoria_ordem: Number(raw.vistoria_ordem || 0),
    vistoria_datahora: raw.vistoria_datahora || '',
    centro_sigla: raw.centro_sigla || '-',
    predio_id: raw.predio_id || '-',
    predio_nome: raw.predio_nome || '',
    tecnico_id: raw.tecnico_id || '',
    tecnico_nome: raw.tecnico_nome || '',
    materiais_texto: raw.materiais_texto || '',
    observacao_tecnica: raw.observacao_tecnica || '',
    status_lista: raw.status_lista || 'PENDENTE',
    created_at: raw.created_at || '',
    updated_at: raw.updated_at || ''
  };
}

function listarPecasFallbackDosChamados_(spreadsheet, chamadoIdFiltro) {
  const sheet = spreadsheet.getSheetByName('chamados');
  if (!sheet) {
    return [];
  }

  const rows = readSheetObjects_(sheet);
  if (!rows.length) {
    return [];
  }

  const target = String(chamadoIdFiltro || '').trim();
  const tecnicosById = getTecnicosByIdPecas_(spreadsheet);
  const allowedStatus = {
    EM_ANALISE: true,
    EM_EXECUCAO: true,
    CONCLUIDO: true
  };
  const itens = [];

  rows.forEach(function(row) {
    const chamadoId = String(row.id || '').trim();
    if (!chamadoId) {
      return;
    }
    if (target && chamadoId !== target) {
      return;
    }

    const status = normalizeChamadoStatusMobile_(row.status, row.executante_id);
    if (!allowedStatus[status]) {
      return;
    }

    const blocos = extrairBlocosVistoriaParaPecas_(row.observacao);
    if (!blocos.length) {
      return;
    }

    const tecnicoId = String(row.executante_id || '').trim();
    const tecnico = tecnicosById[tecnicoId] || null;
    const tecnicoNome = tecnico ? tecnico.nome : '';
    const baseDate = row.updated_at || row.created_at || '';

    blocos.forEach(function(bloco, index) {
      const ordem = index + 1;
      itens.push({
        id: 'LEG-' + chamadoId + '-' + ordem,
        chamado_id: chamadoId,
        chamado_numero: row.numero || chamadoId,
        vistoria_numero: 'V' + ordem,
        vistoria_ordem: ordem,
        vistoria_datahora: bloco.vistoria_datahora || baseDate,
        centro_sigla: row.centro_sigla || '-',
        predio_id: row.predio_id || '-',
        predio_nome: row.predio_id || '',
        tecnico_id: tecnicoId,
        tecnico_nome: tecnicoNome,
        materiais_texto: bloco.materiais_texto || 'Sem materiais informados na vistoria.',
        observacao_tecnica: bloco.observacao_tecnica || '',
        status_lista: 'PENDENTE',
        created_at: row.created_at || '',
        updated_at: row.updated_at || ''
      });
    });
  });

  return itens.sort(function(a, b) {
    const dateDiff = dateValue_(b.vistoria_datahora || b.updated_at || b.created_at || '') -
      dateValue_(a.vistoria_datahora || a.updated_at || a.created_at || '');
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.vistoria_ordem - b.vistoria_ordem;
  });
}

function getTecnicosByIdPecas_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('tecnicos_manutencao');
  if (!sheet) {
    return {};
  }

  return readSheetObjects_(sheet).reduce(function(map, row) {
    const id = String(row.id || '').trim();
    if (!id) {
      return map;
    }
    map[id] = row;
    return map;
  }, {});
}

function extrairBlocosVistoriaParaPecas_(texto) {
  const source = String(texto || '').replace(/\r/g, '').trim();
  if (!source) {
    return [];
  }

  const blocos = source
    .split(/\n{2,}/)
    .map(function(item) {
      return String(item || '').trim();
    })
    .filter(Boolean);
  const result = [];

  blocos.forEach(function(bloco) {
    const normalized = normalizarTextoComparacaoPecas_(bloco);
    if (normalized.indexOf('vistoria tecnica:') < 0 && normalized.indexOf('materiais necessarios:') < 0) {
      return;
    }

    const observacaoExtraida = extrairCampoMultilinhaVistoria_(bloco, /Vistoria t[eé]cnica:\s*(.*)$/i);
    const materiaisExtraidos = extrairCampoMultilinhaVistoria_(bloco, /Materiais necess[aá]rios:\s*(.*)$/i);
    const dataMatch = bloco.match(/GPS capturado em:\s*([^\n]+)/i) || bloco.match(/GPS verificado em:\s*([^\n]+)/i);

    result.push({
      observacao_tecnica: observacaoExtraida,
      materiais_texto: materiaisExtraidos,
      vistoria_datahora: dataMatch ? String(dataMatch[1] || '').trim() : ''
    });
  });

  return result;
}

function extrairCampoMultilinhaVistoria_(bloco, headerPattern) {
  const linhas = String(bloco || '').replace(/\r/g, '').split('\n');
  if (!linhas.length) {
    return '';
  }

  let inicio = -1;
  let primeiraLinha = '';
  for (var i = 0; i < linhas.length; i++) {
    const match = linhas[i].match(headerPattern);
    if (match) {
      inicio = i;
      primeiraLinha = String(match[1] || '').trim();
      break;
    }
  }

  if (inicio < 0) {
    return '';
  }

  const partes = [];
  if (primeiraLinha) {
    partes.push(primeiraLinha);
  }

  for (var j = inicio + 1; j < linhas.length; j++) {
    const atual = String(linhas[j] || '').trim();
    if (!atual) {
      break;
    }

    const normalizada = normalizarTextoComparacaoPecas_(atual);
    if (
      normalizada.indexOf('vistoria tecnica:') === 0 ||
      normalizada.indexOf('materiais necessarios:') === 0 ||
      normalizada.indexOf('ferramentas/equipe necessaria:') === 0 ||
      normalizada.indexOf('resolver na hora:') === 0 ||
      normalizada.indexOf('localizacao gps:') === 0 ||
      normalizada.indexOf('gps capturado em:') === 0 ||
      normalizada.indexOf('gps verificado em:') === 0
    ) {
      break;
    }

    partes.push(atual);
  }

  return partes.join('\n').trim();
}

function normalizarTextoComparacaoPecas_(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildChamadoMobileResponse_(spreadsheet, row, index, chamadoId, status, statusAnterior, updatedAt, prediosById) {
  const getField = function(field) {
    return index ? row[index[field]] : row[field];
  };
  const predios = prediosById || getPrediosByIdForChamadosMobile_(spreadsheet);
  const predioId = getField('predio_id') || '';
  const predio = predios[predioId] || null;
  const statusNormalizado = normalizeChamadoStatusMobile_(
    status || getField('status'),
    getField('executante_id')
  );
  const response = {
    id: chamadoId,
    numero: getField('numero') || chamadoId || '-',
    predio_id: predioId,
    predio_nome: predio ? predio.nome : predioId,
    centro_sigla: getField('centro_sigla') || (predio ? predio.centro_sigla : ''),
    descricao: getField('descricao') || '',
    categoria: getField('categoria') || '',
    prioridade: getField('prioridade') || 'NORMAL',
    status: statusNormalizado,
    observacao: getField('observacao') || '',
    data_abertura: getField('data_abertura') || getField('created_at') || '',
    data_fechamento: getField('data_fechamento') || '',
    updated_at: updatedAt
  };

  if (statusAnterior !== undefined) {
    response.status_anterior = statusAnterior;
  }

  return response;
}

function normalizeChamadoStatusMobile_(status, executanteId) {
  const normalized = String(status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
  const allowed = ['ABERTO', 'ENCAMINHADO', 'EM_ANALISE', 'EM_EXECUCAO', 'CONCLUIDO'];

  if (normalized === 'ABERTO' && String(executanteId || '').trim()) {
    return 'ENCAMINHADO';
  }

  if (allowed.indexOf(normalized) >= 0) {
    return normalized;
  }

  if (String(executanteId || '').trim()) {
    return 'ENCAMINHADO';
  }

  return 'ABERTO';
}

function getUsuariosByReferenceForHistorico_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('usuarios');
  if (!sheet) {
    return {};
  }

  return readSheetObjects_(sheet).reduce(function(map, user) {
    const item = {
      nome: user.nome || '',
      email: user.email || ''
    };
    const id = String(user.id || '').trim();
    const email = normalizeEmail_(user.email);

    if (id) {
      map[id] = item;
    }
    if (email) {
      map[email] = item;
    }

    return map;
  }, {});
}

function getTecnicosByReferenceForHistorico_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('tecnicos');
  if (!sheet) {
    return {};
  }

  return readSheetObjects_(sheet).reduce(function(map, tecnico) {
    const item = {
      nome: tecnico.nome || '',
      email: tecnico.email || ''
    };
    const id = String(tecnico.id || '').trim();
    const login = normalizeTecnicoLogin_(tecnico.login);
    const email = normalizeEmail_(tecnico.email);

    if (id) {
      map[id] = item;
    }
    if (login) {
      map[login] = item;
    }
    if (email) {
      map[email] = item;
    }

    return map;
  }, {});
}

function appendHistoricoChamado_(spreadsheet, chamadoId, usuarioId, acao, statusAnterior, statusNovo, observacao, origem) {
  const sheet = spreadsheet.getSheetByName('historico_chamado');
  if (!sheet) {
    return;
  }

  sheet.appendRow([
    'HIST-' + Utilities.getUuid(),
    chamadoId,
    usuarioId,
    acao,
    origem || 'WEB',
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

