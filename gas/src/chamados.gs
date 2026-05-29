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
    const tecnicoAtivo = String(tecnicoRow[tecnicoIndex.ativo]).toUpperCase() === 'TRUE' || tecnicoRow[tecnicoIndex.ativo] === true;

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
        const predioId = row.predio_id || '';
        const predio = prediosById[predioId] || null;
        return {
          id: row.id || '',
          numero: row.numero || row.id || '-',
          predio_id: predioId,
          predio_nome: predio ? predio.nome : predioId,
          centro_sigla: row.centro_sigla || (predio ? predio.centro_sigla : ''),
          descricao: row.descricao || '',
          categoria: row.categoria || '',
          prioridade: row.prioridade || 'NORMAL',
          status: row.status || 'ENCAMINHADO',
          observacao: row.observacao || '',
          data_abertura: row.data_abertura || row.created_at || '',
          data_fechamento: row.data_fechamento || '',
          updated_at: row.updated_at || ''
        };
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
    const token = String(data.token || '').trim();
    const chamadoId = String(data.chamado_id || data.id || '').trim();

    if (!token) {
      return accessError_('TOKEN_OBRIGATORIO', 'Sessao invalida. Entre novamente.');
    }

    if (!chamadoId) {
      return accessError_('CHAMADO_ID_OBRIGATORIO', 'Informe o chamado para iniciar a vistoria.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const tecnicosSheet = getTecnicosSheet_(spreadsheet);
    const tecnicoLocation = findTecnicoRowByToken_(tecnicosSheet, token);

    if (!tecnicoLocation) {
      return accessError_('SESSAO_INVALIDA', 'Sessao expirada. Entre novamente.');
    }

    const tecnicoIndex = headerIndex_(tecnicoLocation.headers);
    const tecnicoRow = tecnicoLocation.values;
    const tecnicoAtivo = String(tecnicoRow[tecnicoIndex.ativo]).toUpperCase() === 'TRUE' || tecnicoRow[tecnicoIndex.ativo] === true;

    if (!tecnicoAtivo) {
      return accessError_('TECNICO_INATIVO', 'Tecnico inativo.');
    }

    const tecnicoId = String(tecnicoRow[tecnicoIndex.id] || '').trim();
    const chamadosSheet = spreadsheet.getSheetByName('chamados');
    const location = findRowById_(chamadosSheet, chamadoId);

    if (!location) {
      return accessError_('CHAMADO_NAO_ENCONTRADO', 'Chamado nao encontrado.');
    }

    const headers = chamadosSheet.getRange(1, 1, 1, chamadosSheet.getLastColumn()).getValues()[0];
    const index = headerIndex_(headers);
    const row = chamadosSheet.getRange(location.rowNumber, 1, 1, headers.length).getValues()[0];
    const executanteId = String(row[index.executante_id] || '').trim();

    if (executanteId !== tecnicoId) {
      return accessError_('CHAMADO_NAO_ATRIBUIDO', 'Este chamado nao esta atribuido ao tecnico logado.');
    }

    const statusAnterior = String(row[index.status] || '').trim().toUpperCase();
    const allowedStatus = ['ENCAMINHADO', 'EM_ANALISE'];

    if (allowedStatus.indexOf(statusAnterior) < 0) {
      return accessError_('STATUS_INVALIDO_PARA_VISTORIA', 'A vistoria so pode ser iniciada em chamados encaminhados.');
    }

    const now = now_();
    if (statusAnterior !== 'EM_ANALISE') {
      chamadosSheet.getRange(location.rowNumber, index.status + 1).setValue('EM_ANALISE');
      chamadosSheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);
      registrarLocalizacaoChamadoMobile_(spreadsheet, chamadoId, tecnicoId, 'INICIO_VISTORIA', data);
      appendHistoricoChamado_(
        spreadsheet,
        chamadoId,
        tecnicoId,
        'INICIO_VISTORIA',
        statusAnterior,
        'EM_ANALISE',
        appendObservacaoBloco_(
          'Vistoria iniciada pelo aplicativo mobile.',
          buildLocalizacaoResumoMobile_(data)
        ),
        'MOBILE'
      );
      appendSecurityLog_('INICIAR_VISTORIA_MOBILE', 'Vistoria iniciada pelo aplicativo mobile.', 'CHAMADO', chamadoId, {
        tecnico_id: tecnicoId,
        status_anterior: statusAnterior,
        status_novo: 'EM_ANALISE'
      });
    }

    const prediosById = getPrediosByIdForChamadosMobile_(spreadsheet);
    const predioId = row[index.predio_id] || '';
    const predio = prediosById[predioId] || null;

    return success_({
      id: chamadoId,
      numero: row[index.numero] || chamadoId,
      predio_id: predioId,
      predio_nome: predio ? predio.nome : predioId,
      centro_sigla: row[index.centro_sigla] || (predio ? predio.centro_sigla : ''),
      descricao: row[index.descricao] || '',
      categoria: row[index.categoria] || '',
      prioridade: row[index.prioridade] || 'NORMAL',
      status: 'EM_ANALISE',
      status_anterior: statusAnterior,
      observacao: row[index.observacao] || '',
      data_abertura: row[index.data_abertura] || row[index.created_at] || '',
      data_fechamento: row[index.data_fechamento] || '',
      updated_at: now
    });
  } catch (error) {
    return accessError_('INICIAR_VISTORIA_ERROR', error.message);
  }
}

function salvarVistoriaTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const token = String(data.token || '').trim();
    const chamadoId = String(data.chamado_id || data.id || '').trim();
    const observacaoTecnica = String(data.observacao_tecnica || '').trim();
    const materiais = String(data.materiais || '').trim();
    const ferramentas = String(data.ferramentas || '').trim();
    const resolverNaHora = data.resolver_na_hora === true || String(data.resolver_na_hora).toUpperCase() === 'TRUE';

    if (!token) {
      return accessError_('TOKEN_OBRIGATORIO', 'Sessao invalida. Entre novamente.');
    }

    if (!chamadoId) {
      return accessError_('CHAMADO_ID_OBRIGATORIO', 'Informe o chamado para salvar a vistoria.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const tecnicosSheet = getTecnicosSheet_(spreadsheet);
    const tecnicoLocation = findTecnicoRowByToken_(tecnicosSheet, token);

    if (!tecnicoLocation) {
      return accessError_('SESSAO_INVALIDA', 'Sessao expirada. Entre novamente.');
    }

    const tecnicoIndex = headerIndex_(tecnicoLocation.headers);
    const tecnicoRow = tecnicoLocation.values;
    const tecnicoAtivo = String(tecnicoRow[tecnicoIndex.ativo]).toUpperCase() === 'TRUE' || tecnicoRow[tecnicoIndex.ativo] === true;

    if (!tecnicoAtivo) {
      return accessError_('TECNICO_INATIVO', 'Tecnico inativo.');
    }

    const tecnicoId = String(tecnicoRow[tecnicoIndex.id] || '').trim();
    const chamadosSheet = spreadsheet.getSheetByName('chamados');
    const location = findRowById_(chamadosSheet, chamadoId);

    if (!location) {
      return accessError_('CHAMADO_NAO_ENCONTRADO', 'Chamado nao encontrado.');
    }

    const headers = chamadosSheet.getRange(1, 1, 1, chamadosSheet.getLastColumn()).getValues()[0];
    const index = headerIndex_(headers);
    const row = chamadosSheet.getRange(location.rowNumber, 1, 1, headers.length).getValues()[0];
    const executanteId = String(row[index.executante_id] || '').trim();

    if (executanteId !== tecnicoId) {
      return accessError_('CHAMADO_NAO_ATRIBUIDO', 'Este chamado nao esta atribuido ao tecnico logado.');
    }

    const statusAnterior = String(row[index.status] || '').trim().toUpperCase();
    if (statusAnterior !== 'EM_ANALISE') {
      return accessError_('STATUS_INVALIDO_PARA_SALVAR_VISTORIA', 'A vistoria so pode ser salva em chamados em analise.');
    }

    const novoStatus = resolverNaHora ? 'EM_EXECUCAO' : 'EM_ANALISE';
    const now = now_();
    const resumoVistoria = appendObservacaoBloco_(
      buildResumoVistoriaMobile_(observacaoTecnica, materiais, ferramentas, resolverNaHora),
      buildLocalizacaoResumoMobile_(data)
    );
    const observacaoAtual = String(row[index.observacao] || '').trim();
    const observacaoFinal = appendObservacaoBloco_(observacaoAtual, resumoVistoria);

    chamadosSheet.getRange(location.rowNumber, index.status + 1).setValue(novoStatus);
    chamadosSheet.getRange(location.rowNumber, index.observacao + 1).setValue(observacaoFinal);
    chamadosSheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);
    registrarLocalizacaoChamadoMobile_(spreadsheet, chamadoId, tecnicoId, 'VISTORIA_REGISTRADA', data);

    appendHistoricoChamado_(
      spreadsheet,
      chamadoId,
      tecnicoId,
      'VISTORIA_REGISTRADA',
      statusAnterior,
      novoStatus,
      resumoVistoria,
      'MOBILE'
    );
    appendSecurityLog_('SALVAR_VISTORIA_MOBILE', 'Vistoria salva pelo aplicativo mobile.', 'CHAMADO', chamadoId, {
      tecnico_id: tecnicoId,
      status_anterior: statusAnterior,
      status_novo: novoStatus,
      resolver_na_hora: resolverNaHora
    });

    const prediosById = getPrediosByIdForChamadosMobile_(spreadsheet);
    const predioId = row[index.predio_id] || '';
    const predio = prediosById[predioId] || null;

    return success_({
      id: chamadoId,
      numero: row[index.numero] || chamadoId,
      predio_id: predioId,
      predio_nome: predio ? predio.nome : predioId,
      centro_sigla: row[index.centro_sigla] || (predio ? predio.centro_sigla : ''),
      descricao: row[index.descricao] || '',
      categoria: row[index.categoria] || '',
      prioridade: row[index.prioridade] || 'NORMAL',
      status: novoStatus,
      status_anterior: statusAnterior,
      observacao: observacaoFinal,
      observacao_tecnica: observacaoTecnica,
      materiais: materiais,
      ferramentas: ferramentas,
      resolver_na_hora: resolverNaHora,
      data_abertura: row[index.data_abertura] || row[index.created_at] || '',
      data_fechamento: row[index.data_fechamento] || '',
      updated_at: now
    });
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
  const tecnicoAtivo = String(tecnicoRow[tecnicoIndex.ativo]).toUpperCase() === 'TRUE' || tecnicoRow[tecnicoIndex.ativo] === true;

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
    tecnicoId: tecnicoId
  };
}

function buildChamadoMobileResponse_(spreadsheet, row, index, chamadoId, status, statusAnterior, updatedAt) {
  const prediosById = getPrediosByIdForChamadosMobile_(spreadsheet);
  const predioId = row[index.predio_id] || '';
  const predio = prediosById[predioId] || null;

  return {
    id: chamadoId,
    numero: row[index.numero] || chamadoId,
    predio_id: predioId,
    predio_nome: predio ? predio.nome : predioId,
    centro_sigla: row[index.centro_sigla] || (predio ? predio.centro_sigla : ''),
    descricao: row[index.descricao] || '',
    categoria: row[index.categoria] || '',
    prioridade: row[index.prioridade] || 'NORMAL',
    status: status,
    status_anterior: statusAnterior,
    observacao: row[index.observacao] || '',
    data_abertura: row[index.data_abertura] || row[index.created_at] || '',
    data_fechamento: row[index.data_fechamento] || '',
    updated_at: updatedAt
  };
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

