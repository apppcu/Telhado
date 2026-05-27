function enviarEmail(destinatario, assunto, corpo) {
  GmailApp.sendEmail(destinatario, assunto, corpo);
}

const VALIDACAO_POS_CHUVA_STATUS = {
  EMAIL_ENVIADO: 'EMAIL_ENVIADO',
  APROVADO: 'APROVADO',
  REINCIDENCIA: 'REINCIDENCIA'
};

function monitorarValidacoesPosChuva() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const chuva = consultarChuvaObservadaOntem();
  const threshold = Number(CONFIG.CHUVA_THRESHOLD_MM || 5);

  if (chuva.volume_mm < threshold) {
    appendSyncLog_(spreadsheet, 'SUCESSO', 'Chuva abaixo do limite para validacao pos-chuva.', chuva);
    return success_({
      data_referencia: chuva.data_referencia,
      volume_mm: chuva.volume_mm,
      emails_enviados: 0
    });
  }

  const evento = getOrCreateEventoChuva_(spreadsheet, chuva);
  if (evento.processado) {
    appendSyncLog_(spreadsheet, 'SUCESSO', 'Evento de chuva ja processado.', evento);
    return success_({
      evento_chuva_id: evento.id,
      data_referencia: chuva.data_referencia,
      volume_mm: chuva.volume_mm,
      emails_enviados: 0,
      ja_processado: true
    });
  }

  const chamados = getChamadosConcluidosParaValidacao_(spreadsheet, chuva.data_referencia);
  let enviados = 0;

  chamados.forEach(function(chamado) {
    if (findValidacaoByChamadoEvento_(spreadsheet, chamado.id, evento.id)) {
      return;
    }

    const solicitante = findUsuarioByIdOrEmail_(chamado.solicitante_id);
    if (!solicitante || !solicitante.email) {
      appendSyncLog_(spreadsheet, 'ERRO', 'Solicitante sem e-mail para validacao pos-chuva.', {
        chamado_id: chamado.id,
        solicitante_id: chamado.solicitante_id
      });
      return;
    }

    const validacao = createValidacaoPosChuva_(spreadsheet, chamado, evento, solicitante);
    enviarEmailValidacaoPosChuva_(solicitante, chamado, evento, validacao);
    enviados++;
  });

  markEventoChuvaProcessado_(spreadsheet, evento.id);
  appendSyncLog_(spreadsheet, 'SUCESSO', 'Monitoramento pos-chuva processado.', {
    evento_chuva_id: evento.id,
    data_referencia: chuva.data_referencia,
    volume_mm: chuva.volume_mm,
    emails_enviados: enviados
  });

  return success_({
    evento_chuva_id: evento.id,
    data_referencia: chuva.data_referencia,
    volume_mm: chuva.volume_mm,
    emails_enviados: enviados
  });
}

function instalarTriggerMonitoramentoPosChuva() {
  removerTriggerMonitoramentoPosChuva();
  ScriptApp.newTrigger('monitorarValidacoesPosChuva')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .nearMinute(0)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  return success_({
    trigger: 'monitorarValidacoesPosChuva',
    horario: '06:00',
    timezone: CONFIG.TIMEZONE
  });
}

function removerTriggerMonitoramentoPosChuva() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'monitorarValidacoesPosChuva') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  return success_({
    trigger: 'monitorarValidacoesPosChuva',
    removido: true
  });
}

function simularEmailValidacaoPosChuvaFabio() {
  const destinatario = 'fabiodias@uel.br';
  const assunto = 'Simulacao - Validacao pos-chuva do chamado CH-TESTE';
  const simUrl = ScriptApp.getService().getUrl() + '?action=validar_pos_chuva&token=SIMULACAO&resposta=sim';
  const naoUrl = ScriptApp.getService().getUrl() + '?action=validar_pos_chuva&token=SIMULACAO&resposta=nao';
  const texto =
    'Ola, Fabio.\n\n' +
    'Esta e uma simulacao do e-mail de validacao pos-chuva do Sistema de Telhados.\n\n' +
    'Chamado: CH-TESTE\n' +
    'Chuva registrada: 5 mm ou mais\n\n' +
    'Sim, resolveu: ' + simUrl + '\n' +
    'Nao, ainda vaza: ' + naoUrl + '\n\n' +
    'Sistema de Telhados - Prefeitura do Campus Universitario';
  const html =
    '<p>Ola, Fabio.</p>' +
    '<p>Esta e uma simulacao do e-mail de validacao pos-chuva do <strong>Sistema de Telhados</strong>.</p>' +
    '<p><strong>Chamado:</strong> CH-TESTE<br><strong>Chuva registrada:</strong> 5 mm ou mais</p>' +
    '<p>' +
      '<a href="' + simUrl + '" style="display:inline-block;padding:12px 16px;margin-right:8px;background:#0b6b57;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Sim, resolveu</a>' +
      '<a href="' + naoUrl + '" style="display:inline-block;padding:12px 16px;background:#9d2d20;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Nao, ainda vaza</a>' +
    '</p>' +
    '<p>Sistema de Telhados - Prefeitura do Campus Universitario</p>';

  GmailApp.sendEmail(destinatario, assunto, texto, { htmlBody: html });
  return success_({
    enviado_para: destinatario,
    assunto: assunto
  });
}

function responderValidacaoPosChuva(token, resposta) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const normalizedToken = String(token || '').trim();
  const normalizedResposta = String(resposta || '').trim().toLowerCase();

  if (!normalizedToken) {
    return renderValidacaoPosChuvaPage_('Link invalido', 'Token de validacao nao informado.');
  }

  if (['sim', 'nao'].indexOf(normalizedResposta) < 0) {
    return renderValidacaoPosChuvaPage_('Resposta invalida', 'Use um dos botoes enviados por e-mail.');
  }

  const validacao = findValidacaoByToken_(spreadsheet, normalizedToken);
  if (!validacao) {
    return renderValidacaoPosChuvaPage_('Validacao nao encontrada', 'Nao encontramos esta solicitacao de validacao.');
  }

  if (validacao.row.status_validacao !== VALIDACAO_POS_CHUVA_STATUS.EMAIL_ENVIADO) {
    return renderValidacaoPosChuvaPage_('Validacao ja respondida', 'Esta validacao pos-chuva ja foi registrada.');
  }

  if (normalizedResposta === 'sim') {
    updateValidacaoPosChuva_(spreadsheet, validacao, VALIDACAO_POS_CHUVA_STATUS.APROVADO, {
      resposta: 'sim',
      mensagem: 'Usuario confirmou que o servico ficou bom e nao houve novo vazamento.'
    });
    return renderValidacaoPosChuvaPage_('Obrigado pela confirmacao', 'Registramos que o servico resolveu o vazamento.');
  }

  const novoChamado = criarChamadoReincidencia_(spreadsheet, validacao);
  updateValidacaoPosChuva_(spreadsheet, validacao, VALIDACAO_POS_CHUVA_STATUS.REINCIDENCIA, {
    resposta: 'nao',
    mensagem: 'Usuario informou que ainda ha vazamento apos chuva.',
    novo_chamado_id: novoChamado.id,
    novo_chamado_numero: novoChamado.numero
  });

  return renderValidacaoPosChuvaPage_(
    'Novo chamado aberto',
    'Registramos a reincidencia e abrimos automaticamente o chamado ' + novoChamado.numero + '.'
  );
}

function getOrCreateEventoChuva_(spreadsheet, chuva) {
  const sheet = spreadsheet.getSheetByName('eventos_chuva');
  const rows = readSheetObjects_(sheet);
  const existing = rows.find(function(row) {
    return String(row.data_referencia || '').slice(0, 10) === chuva.data_referencia;
  });

  if (existing) {
    return {
      id: existing.id,
      data_referencia: existing.data_referencia,
      volume_mm: Number(existing.volume_mm || 0),
      processado: String(existing.processado).toUpperCase() === 'TRUE' || existing.processado === true
    };
  }

  const id = 'CHUVA-' + Utilities.getUuid();
  const now = now_();
  sheet.appendRow([
    id,
    chuva.data_referencia,
    chuva.data_referencia + 'T00:00:00',
    chuva.data_referencia + 'T23:59:59',
    24,
    chuva.volume_mm,
    'OPEN_METEO',
    -23.3045,
    -51.1696,
    'Londrina/PR',
    false,
    now
  ]);

  return {
    id: id,
    data_referencia: chuva.data_referencia,
    volume_mm: chuva.volume_mm,
    processado: false
  };
}

function markEventoChuvaProcessado_(spreadsheet, eventoId) {
  const sheet = spreadsheet.getSheetByName('eventos_chuva');
  const location = findRowById_(sheet, eventoId);
  if (!location) {
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  sheet.getRange(location.rowNumber, index.processado + 1).setValue(true);
}

function getChamadosConcluidosParaValidacao_(spreadsheet, dataReferencia) {
  const sheet = spreadsheet.getSheetByName('chamados');
  const rows = readSheetObjects_(sheet);
  const eventTime = new Date(dataReferencia + 'T12:00:00').getTime();
  const minTime = eventTime - (30 * 24 * 60 * 60 * 1000);

  return rows.filter(function(row) {
    const status = String(row.status || '').trim().toUpperCase();
    const fechamento = new Date(row.data_fechamento || row.updated_at || '').getTime();
    return status === 'CONCLUIDO' && !isNaN(fechamento) && fechamento >= minTime && fechamento <= eventTime;
  });
}

function createValidacaoPosChuva_(spreadsheet, chamado, evento, solicitante) {
  const sheet = spreadsheet.getSheetByName('validacoes_pos_chuva');
  const id = 'VAL-' + Utilities.getUuid();
  const token = Utilities.getUuid();
  const now = now_();
  const meta = {
    token: token,
    chamado_numero: chamado.numero || chamado.id,
    evento_data: evento.data_referencia,
    evento_volume_mm: evento.volume_mm,
    solicitante_email: solicitante.email
  };

  sheet.appendRow([
    id,
    chamado.id,
    evento.id,
    chamado.predio_id || '',
    VALIDACAO_POS_CHUVA_STATUS.EMAIL_ENVIADO,
    JSON.stringify(meta),
    chamado.solicitante_id || '',
    now,
    now
  ]);

  return {
    id: id,
    token: token
  };
}

function enviarEmailValidacaoPosChuva_(solicitante, chamado, evento, validacao) {
  const baseUrl = ScriptApp.getService().getUrl();
  const simUrl = baseUrl + '?action=validar_pos_chuva&token=' + encodeURIComponent(validacao.token) + '&resposta=sim';
  const naoUrl = baseUrl + '?action=validar_pos_chuva&token=' + encodeURIComponent(validacao.token) + '&resposta=nao';
  const numero = chamado.numero || chamado.id;
  const assunto = 'Validacao pos-chuva do chamado ' + numero;
  const texto =
    'Ola, ' + (solicitante.nome || '') + '.\n\n' +
    'Apos a chuva registrada em Londrina/PR em ' + evento.data_referencia + ' (' + evento.volume_mm + ' mm), precisamos confirmar se o servico do chamado ' + numero + ' resolveu o vazamento.\n\n' +
    'Sim, resolveu: ' + simUrl + '\n' +
    'Nao, ainda vaza: ' + naoUrl + '\n\n' +
    'Sistema de Telhados - Prefeitura do Campus Universitario';
  const html =
    '<p>Ola, ' + escapeEmailHtml_(solicitante.nome || '') + '.</p>' +
    '<p>Apos a chuva registrada em Londrina/PR em <strong>' + escapeEmailHtml_(evento.data_referencia) + '</strong> (' + escapeEmailHtml_(evento.volume_mm) + ' mm), precisamos confirmar se o servico do chamado <strong>' + escapeEmailHtml_(numero) + '</strong> resolveu o vazamento.</p>' +
    '<p>' +
      '<a href="' + simUrl + '" style="display:inline-block;padding:12px 16px;margin-right:8px;background:#0b6b57;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Sim, resolveu</a>' +
      '<a href="' + naoUrl + '" style="display:inline-block;padding:12px 16px;background:#9d2d20;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;">Nao, ainda vaza</a>' +
    '</p>' +
    '<p>Sistema de Telhados - Prefeitura do Campus Universitario</p>';

  GmailApp.sendEmail(solicitante.email, assunto, texto, { htmlBody: html });
}

function findValidacaoByChamadoEvento_(spreadsheet, chamadoId, eventoId) {
  const sheet = spreadsheet.getSheetByName('validacoes_pos_chuva');
  const rows = readSheetObjects_(sheet);
  return rows.find(function(row) {
    return String(row.chamado_id || '') === String(chamadoId || '') &&
      String(row.evento_chuva_id || '') === String(eventoId || '');
  });
}

function findValidacaoByToken_(spreadsheet, token) {
  const sheet = spreadsheet.getSheetByName('validacoes_pos_chuva');
  const rows = readSheetObjects_(sheet);

  for (var i = 0; i < rows.length; i++) {
    const meta = parseValidacaoMeta_(rows[i].observacao);
    if (meta.token === token) {
      return {
        rowNumber: i + 2,
        row: rows[i],
        meta: meta
      };
    }
  }

  return null;
}

function updateValidacaoPosChuva_(spreadsheet, validacao, status, extraMeta) {
  const sheet = spreadsheet.getSheetByName('validacoes_pos_chuva');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const meta = Object.assign({}, validacao.meta, extraMeta || {}, {
    respondido_em: now_()
  });

  sheet.getRange(validacao.rowNumber, index.status_validacao + 1).setValue(status);
  sheet.getRange(validacao.rowNumber, index.observacao + 1).setValue(JSON.stringify(meta));
  sheet.getRange(validacao.rowNumber, index.updated_at + 1).setValue(now_());
}

function criarChamadoReincidencia_(spreadsheet, validacao) {
  const chamadoOriginal = getChamadoById_(spreadsheet, validacao.row.chamado_id);
  if (!chamadoOriginal) {
    throw new Error('Chamado original nao encontrado para reincidencia.');
  }

  const sheet = spreadsheet.getSheetByName('chamados');
  const now = now_();
  const chamadoId = 'CHAM-' + Utilities.getUuid();
  const numero = nextChamadoNumero_(sheet);
  const descricao =
    'Reincidencia apos chuva referente ao chamado original ' +
    (chamadoOriginal.numero || chamadoOriginal.id) +
    '. Usuario informou que ainda ha vazamento apos validacao pos-chuva.';

  sheet.appendRow([
    chamadoId,
    numero,
    chamadoOriginal.predio_id || '',
    chamadoOriginal.centro_sigla || '',
    chamadoOriginal.solicitante_id || validacao.row.responsavel_id || '',
    descricao,
    'VAZAMENTO',
    'ALTA',
    'ABERTO',
    '',
    now,
    '',
    'Gerado automaticamente por reincidencia pos-chuva.',
    now,
    now
  ]);

  appendHistoricoChamado_(
    spreadsheet,
    chamadoId,
    chamadoOriginal.solicitante_id || validacao.row.responsavel_id || '',
    'REINCIDENCIA_POS_CHUVA',
    '',
    'ABERTO',
    'Chamado gerado automaticamente a partir da validacao pos-chuva do chamado ' + (chamadoOriginal.numero || chamadoOriginal.id) + '.'
  );

  return {
    id: chamadoId,
    numero: numero
  };
}

function getChamadoById_(spreadsheet, chamadoId) {
  const sheet = spreadsheet.getSheetByName('chamados');
  const rows = readSheetObjects_(sheet);
  return rows.find(function(row) {
    return String(row.id || '') === String(chamadoId || '');
  }) || null;
}

function parseValidacaoMeta_(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch (error) {
    return {};
  }
}

function renderValidacaoPosChuvaPage_(title, message) {
  return HtmlService
    .createHtmlOutput(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeEmailHtml_(title) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;background:#f3f7f4;color:#10201b;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:560px;background:#fff;border:1px solid #dce6e1;border-radius:8px;padding:28px}h1{margin:0 0 12px;font-size:26px}p{line-height:1.5;color:#66726d}</style>' +
      '</head><body><main class="card"><h1>' + escapeEmailHtml_(title) + '</h1><p>' + escapeEmailHtml_(message) + '</p></main></body></html>'
    )
    .setTitle(title);
}

function escapeEmailHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

