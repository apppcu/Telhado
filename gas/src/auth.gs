// @version:1.0.0

const UEL_DOMAIN = '@uel.br';
const ACCESS_STATES = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  NOT_REGISTERED: 'NOT_REGISTERED',
  DOMAIN_DENIED: 'DOMAIN_DENIED',
  UNKNOWN_EMAIL: 'UNKNOWN_EMAIL'
};
const ACCESS_PROFILES = {
  USUARIO: 'USUARIO',
  ADMIN: 'ADMIN'
};
const ACCESS_PROFILE_VALUES = [ACCESS_PROFILES.USUARIO, ACCESS_PROFILES.ADMIN];

function getSessionContext(payload) {
  try {
    const data = payload || {};
    const typedEmail = normalizeEmail_(data.email || data.auth_email);
    const sessionEmail = getCurrentUserEmail_();
    const email = sessionEmail || typedEmail;

    if (!email) {
      return success_({
        email: '',
        domainAllowed: false,
        accessState: ACCESS_STATES.UNKNOWN_EMAIL,
        user: null
      });
    }

    if (sessionEmail && typedEmail && typedEmail !== sessionEmail) {
      return accessError_(
        'EMAIL_DIVERGENTE',
        'O e-mail digitado nao confere com a conta Google logada no navegador.'
      );
    }

    if (!isUelEmail_(email)) {
      return success_({
        email: email,
        domainAllowed: false,
        accessState: ACCESS_STATES.DOMAIN_DENIED,
        user: null
      });
    }

    const user = findUsuarioByEmail_(email);
    if (!user) {
      return success_({
        email: email,
        domainAllowed: true,
        accessState: ACCESS_STATES.NOT_REGISTERED,
        user: null
      });
    }

    const active = isTrue_(user.ativo);
    if (active) {
      appendSecurityLog_('LOGIN_WEB', 'Entrada autorizada no painel web.', 'USUARIO', user.email || email, {
        usuario_id: user.id || '',
        perfil: user.perfil || ''
      });
    }

    return success_({
      email: email,
      domainAllowed: true,
      accessState: active ? ACCESS_STATES.ACTIVE : ACCESS_STATES.PENDING,
      user: user
    });
  } catch (error) {
    return accessError_('ACCESS_CONTEXT_ERROR', error.message);
  }
}

function diagnosticarSessao() {
  try {
    const activeEmail = normalizeEmail_(Session.getActiveUser().getEmail());
    const effectiveEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
    const user = activeEmail ? findUsuarioByEmail_(activeEmail) : null;

    return success_({
      activeEmail: activeEmail,
      effectiveEmail: effectiveEmail,
      domainAllowed: isUelEmail_(activeEmail),
      usuarioEncontrado: Boolean(user),
      usuarioAtivo: user ? isTrue_(user.ativo) : false,
      usuarioPerfil: user ? user.perfil : '',
      usuarioCentro: user ? user.centro_sigla : ''
    });
  } catch (error) {
    return accessError_('SESSION_DIAGNOSTIC_ERROR', error.message);
  }
}

function registrarAcesso(payload) {
  try {
    const data = payload || {};
    const email = getCurrentUserEmail_();
    const typedEmail = normalizeEmail_(data.email);
    const nome = String(data.nome || '').trim();
    const telefone = String(data.telefone || '').trim();
    const centroSigla = String(data.centro_sigla || '').trim().toUpperCase();
    const observacao = String(data.observacao || '').trim();

    if (!nome) {
      return accessError_('NOME_OBRIGATORIO', 'Informe o nome para solicitar acesso.');
    }

    if (!email) {
      return accessError_('CONTA_GOOGLE_NAO_IDENTIFICADA', 'Nao foi possivel identificar a conta Google logada no navegador.');
    }

    if (typedEmail && typedEmail !== email) {
      return accessError_('EMAIL_DIVERGENTE', 'O e-mail informado deve ser o mesmo da conta Google logada no navegador.');
    }

    if (!email || !isUelEmail_(email)) {
      return accessError_('DOMINIO_NAO_PERMITIDO', 'Acesso restrito a contas institucionais @uel.br.');
    }

    if (!centroSigla || !centroExists_(centroSigla)) {
      return accessError_('CENTRO_INVALIDO', 'Selecione um centro institucional valido.');
    }

    const existing = findUsuarioByEmail_(email);
    if (existing) {
      return success_({
        accessState: isTrue_(existing.ativo) ? ACCESS_STATES.ACTIVE : ACCESS_STATES.PENDING,
        user: existing
      });
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const now = now_();
    const row = [
      'USR-' + Utilities.getUuid(),
      nome,
      email,
      ACCESS_PROFILES.USUARIO,
      centroSigla,
      telefone,
      false,
      now,
      now
    ];

    sheet.appendRow(row);
    appendAccessLog_('SUCESSO', 'Solicitacao de acesso registrada.', 'USUARIO', email, {
      nome: nome,
      centro_sigla: centroSigla,
      perfil_padrao: ACCESS_PROFILES.USUARIO,
      observacao: observacao
    });

    return success_({
      accessState: ACCESS_STATES.PENDING,
      user: {
        nome: nome,
        email: email,
        perfil: ACCESS_PROFILES.USUARIO,
        centro_sigla: centroSigla,
        ativo: false
      }
    });
  } catch (error) {
    appendAccessLog_('ERRO', error.message, 'USUARIO', '', {});
    return accessError_('REGISTRO_ACESSO_ERROR', error.message);
  }
}

function aprovarAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem aprovar acessos.');
    }

    const email = normalizeEmail_(data.email);
    const perfil = normalizeAccessProfile_(data.perfil || ACCESS_PROFILES.USUARIO);

    if (!email || !isUelEmail_(email)) {
      return accessError_('EMAIL_INVALIDO', 'Informe um e-mail institucional valido.');
    }

    if (!perfil) {
      return accessError_('PERFIL_INVALIDO', 'Selecione um perfil valido.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const location = findUsuarioRowByEmail_(sheet, email);

    if (!location) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Solicitacao de acesso nao encontrada.');
    }

    const index = headerIndex_(location.headers);
    const now = now_();
    sheet.getRange(location.rowNumber, index.perfil + 1).setValue(perfil);
    sheet.getRange(location.rowNumber, index.ativo + 1).setValue(true);
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);

    appendAccessLog_('SUCESSO', 'Acesso aprovado.', 'USUARIO', email, {
      perfil: perfil,
      aprovado_por: admin.email || ''
    });
    appendSecurityLog_('APROVAR_ACESSO', 'Acesso aprovado.', 'USUARIO', email, {
      perfil: perfil,
      aprovado_por: admin.email || ''
    });

    return success_({
      email: email,
      perfil: perfil,
      ativo: true,
      updated_at: now
    });
  } catch (error) {
    return accessError_('APROVAR_ACESSO_ERROR', error.message);
  }
}

function rejeitarAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem rejeitar acessos.');
    }

    const email = normalizeEmail_(data.email);
    if (!email || !isUelEmail_(email)) {
      return accessError_('EMAIL_INVALIDO', 'Informe um e-mail institucional valido.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const location = findUsuarioRowByEmail_(sheet, email);

    if (!location) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Solicitacao de acesso nao encontrada.');
    }

    sheet.deleteRow(location.rowNumber);
    appendAccessLog_('SUCESSO', 'Acesso rejeitado.', 'USUARIO', email, {
      rejeitado_por: admin.email || ''
    });
    appendSecurityLog_('REJEITAR_ACESSO', 'Acesso rejeitado.', 'USUARIO', email, {
      rejeitado_por: admin.email || ''
    });

    return success_({
      email: email,
      rejeitado: true
    });
  } catch (error) {
    return accessError_('REJEITAR_ACESSO_ERROR', error.message);
  }
}

function listarUsuariosAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem gerenciar usuarios.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const usuarios = readSheetObjects_(sheet)
      .map(function(row) {
        const ativo = isTrue_(row.ativo);
        return {
          id: String(row.id || '').trim(),
          nome: String(row.nome || '').trim(),
          email: normalizeEmail_(row.email),
          perfil: normalizeAccessProfile_(row.perfil) || ACCESS_PROFILES.USUARIO,
          centro_sigla: String(row.centro_sigla || '').trim().toUpperCase(),
          telefone: String(row.telefone || '').trim(),
          ativo: ativo,
          pendente: !ativo,
          created_at: row.created_at || '',
          updated_at: row.updated_at || ''
        };
      })
      .sort(function(a, b) {
        if (a.ativo !== b.ativo) {
          return a.ativo ? 1 : -1;
        }
        return dateValue_(b.updated_at || b.created_at) - dateValue_(a.updated_at || a.created_at);
      });

    const resumo = usuarios.reduce(function(acc, item) {
      acc.total++;
      if (item.ativo) {
        acc.ativos++;
      } else {
        acc.pendentes++;
      }
      if (item.perfil === ACCESS_PROFILES.ADMIN) {
        acc.admins++;
      }
      return acc;
    }, {
      total: 0,
      ativos: 0,
      pendentes: 0,
      admins: 0
    });

    return success_({
      usuarios: usuarios,
      resumo: resumo
    });
  } catch (error) {
    return accessError_('LISTAR_USUARIOS_ACESSO_ERROR', error.message);
  }
}

function criarUsuarioAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem criar usuarios.');
    }

    const nome = String(data.nome || '').trim();
    const email = normalizeEmail_(data.email);
    const perfil = normalizeAccessProfile_(data.perfil || ACCESS_PROFILES.USUARIO);
    const centroSigla = String(data.centro_sigla || '').trim().toUpperCase();
    const telefone = String(data.telefone || '').trim();
    const ativo = data.ativo === undefined ? true : isTrue_(data.ativo);

    if (!nome) {
      return accessError_('NOME_OBRIGATORIO', 'Informe o nome do usuario.');
    }

    if (!email || !isUelEmail_(email)) {
      return accessError_('EMAIL_INVALIDO', 'Informe um e-mail institucional valido.');
    }

    if (!perfil) {
      return accessError_('PERFIL_INVALIDO', 'Selecione um perfil valido.');
    }

    if (!centroSigla || !centroExists_(centroSigla)) {
      return accessError_('CENTRO_INVALIDO', 'Selecione um centro institucional valido.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const existing = findUsuarioRowByEmail_(sheet, email);

    if (existing) {
      return accessError_('USUARIO_JA_EXISTE', 'Ja existe um usuario cadastrado com este e-mail.');
    }

    const now = now_();
    sheet.appendRow([
      'USR-' + Utilities.getUuid(),
      nome,
      email,
      perfil,
      centroSigla,
      telefone,
      ativo,
      now,
      now
    ]);

    appendSecurityLog_('CRIAR_USUARIO_ACESSO', 'Usuario criado manualmente no painel web.', 'USUARIO', email, {
      criado_por: admin.email || '',
      perfil: perfil,
      ativo: ativo,
      centro_sigla: centroSigla
    });

    return success_({
      nome: nome,
      email: email,
      perfil: perfil,
      centro_sigla: centroSigla,
      telefone: telefone,
      ativo: ativo
    });
  } catch (error) {
    return accessError_('CRIAR_USUARIO_ACESSO_ERROR', error.message);
  }
}

function atualizarUsuarioAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem atualizar usuarios.');
    }

    const userId = String(data.user_id || '').trim();
    const originalEmail = normalizeEmail_(data.original_email || data.email);
    const nome = String(data.nome || '').trim();
    const email = normalizeEmail_(data.email);
    const perfil = normalizeAccessProfile_(data.perfil || ACCESS_PROFILES.USUARIO);
    const centroSigla = String(data.centro_sigla || '').trim().toUpperCase();
    const telefone = String(data.telefone || '').trim();

    if (!nome) {
      return accessError_('NOME_OBRIGATORIO', 'Informe o nome do usuario.');
    }

    if (!email || !isUelEmail_(email)) {
      return accessError_('EMAIL_INVALIDO', 'Informe um e-mail institucional valido.');
    }

    if (!perfil) {
      return accessError_('PERFIL_INVALIDO', 'Selecione um perfil valido.');
    }

    if (!centroSigla || !centroExists_(centroSigla)) {
      return accessError_('CENTRO_INVALIDO', 'Selecione um centro institucional valido.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const location = userId ? findUsuarioRowById_(sheet, userId) : findUsuarioRowByEmail_(sheet, originalEmail);

    if (!location) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.');
    }

    const index = headerIndex_(location.headers);
    const currentEmail = normalizeEmail_(location.values[index.email]);
    const emailChanged = email !== currentEmail;

    if (emailChanged) {
      const duplicate = findUsuarioRowByEmail_(sheet, email);
      if (duplicate && duplicate.rowNumber !== location.rowNumber) {
        return accessError_('USUARIO_JA_EXISTE', 'Ja existe um usuario cadastrado com este e-mail.');
      }
    }

    const now = now_();
    sheet.getRange(location.rowNumber, index.nome + 1).setValue(nome);
    sheet.getRange(location.rowNumber, index.email + 1).setValue(email);
    sheet.getRange(location.rowNumber, index.perfil + 1).setValue(perfil);
    sheet.getRange(location.rowNumber, index.centro_sigla + 1).setValue(centroSigla);
    sheet.getRange(location.rowNumber, index.telefone + 1).setValue(telefone);
    if (typeof index.updated_at === 'number' && index.updated_at >= 0) {
      sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);
    }

    appendSecurityLog_('ATUALIZAR_USUARIO_ACESSO', 'Usuario atualizado no painel web.', 'USUARIO', email, {
      atualizado_por: admin.email || '',
      user_id: userId || '',
      email_anterior: currentEmail
    });

    return success_({
      id: userId || String(location.values[index.id] || '').trim(),
      nome: nome,
      email: email,
      perfil: perfil,
      centro_sigla: centroSigla,
      telefone: telefone,
      updated_at: now
    });
  } catch (error) {
    return accessError_('ATUALIZAR_USUARIO_ACESSO_ERROR', error.message);
  }
}

function alternarAtivoUsuarioAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem alterar status de usuario.');
    }

    const userId = String(data.user_id || '').trim();
    const email = normalizeEmail_(data.email);
    const ativo = isTrue_(data.ativo);

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const location = userId ? findUsuarioRowById_(sheet, userId) : findUsuarioRowByEmail_(sheet, email);

    if (!location) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.');
    }

    const index = headerIndex_(location.headers);
    const targetEmail = normalizeEmail_(location.values[index.email]);
    if (targetEmail && targetEmail === normalizeEmail_(admin.email)) {
      return accessError_('OPERACAO_NAO_PERMITIDA', 'Nao e permitido bloquear seu proprio acesso.');
    }

    const now = now_();
    sheet.getRange(location.rowNumber, index.ativo + 1).setValue(ativo);
    if (typeof index.updated_at === 'number' && index.updated_at >= 0) {
      sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);
    }

    appendSecurityLog_('ALTERAR_STATUS_USUARIO_ACESSO', ativo ? 'Usuario ativado.' : 'Usuario bloqueado.', 'USUARIO', targetEmail, {
      alterado_por: admin.email || '',
      ativo: ativo
    });

    return success_({
      email: targetEmail,
      ativo: ativo,
      updated_at: now
    });
  } catch (error) {
    return accessError_('ALTERAR_STATUS_USUARIO_ACESSO_ERROR', error.message);
  }
}

function excluirUsuarioAcesso(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    const adminActive = admin && isTrue_(admin.ativo);

    if (!adminActive || !canManageAccess_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem excluir usuarios.');
    }

    const userId = String(data.user_id || '').trim();
    const email = normalizeEmail_(data.email);

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('usuarios');
    const location = userId ? findUsuarioRowById_(sheet, userId) : findUsuarioRowByEmail_(sheet, email);

    if (!location) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.');
    }

    const index = headerIndex_(location.headers);
    const targetEmail = normalizeEmail_(location.values[index.email]);
    if (targetEmail && targetEmail === normalizeEmail_(admin.email)) {
      return accessError_('OPERACAO_NAO_PERMITIDA', 'Nao e permitido excluir seu proprio acesso.');
    }

    sheet.deleteRow(location.rowNumber);

    appendSecurityLog_('EXCLUIR_USUARIO_ACESSO', 'Usuario excluido no painel web.', 'USUARIO', targetEmail, {
      excluido_por: admin.email || '',
      user_id: userId || ''
    });

    return success_({
      email: targetEmail,
      excluido: true
    });
  } catch (error) {
    return accessError_('EXCLUIR_USUARIO_ACESSO_ERROR', error.message);
  }
}

function getCentrosAtivos() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('centros');
    const rows = readSheetObjects_(sheet);
    const centros = rows
      .filter(function(row) {
      return isTrue_(row.ativo);
      })
      .map(function(row) {
        return {
          id: row.id,
          sigla: row.sigla,
          nome: row.nome
        };
      });

    return success_(centros);
  } catch (error) {
    return accessError_('CENTROS_ERROR', error.message);
  }
}

function findUsuarioByEmail_(email) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('usuarios');
  const rows = readSheetObjects_(sheet);
  const normalized = normalizeEmail_(email);

  for (var i = 0; i < rows.length; i++) {
    if (normalizeEmail_(rows[i].email) === normalized) {
      return rows[i];
    }
  }

  return null;
}

function findUsuarioById_(id) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('usuarios');
  const rows = readSheetObjects_(sheet);
  const target = String(id || '').trim();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id || '').trim() === target) {
      return rows[i];
    }
  }

  return null;
}

function findUsuarioByIdOrEmail_(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  if (raw.indexOf('@') >= 0) {
    return findUsuarioByEmail_(raw);
  }

  return findUsuarioById_(raw);
}

function centroExists_(sigla) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('centros');
  const rows = readSheetObjects_(sheet);
  const target = String(sigla || '').trim().toUpperCase();

  return rows.some(function(row) {
    const active = isTrue_(row.ativo);
    return active && String(row.sigla || '').trim().toUpperCase() === target;
  });
}

function findUsuarioRowByEmail_(sheet, email) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();
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

function readSheetObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();

  return values
    .filter(function(row) {
      return row.some(function(value) {
        return String(value || '').trim() !== '';
      });
    })
    .map(function(row) {
      const item = {};
      headers.forEach(function(header, index) {
        if (header) {
          item[String(header).trim()] = normalizeSheetValue_(row[index]);
        }
      });
      return item;
    });
}

function normalizeSheetValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }

  return value;
}

function getCurrentUserEmail_() {
  return normalizeEmail_(Session.getActiveUser().getEmail());
}

function findUsuarioRowById_(sheet, userId) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const target = String(userId || '').trim();
  if (!target) {
    return null;
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();

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

function getAccessEmailFromPayload_(payload) {
  const sessionEmail = getCurrentUserEmail_();
  if (sessionEmail) {
    return sessionEmail;
  }

  const data = payload || {};
  return normalizeEmail_(data.auth_email || data.email);
}

function getAuthorizedUserFromPayload_(payload) {
  const email = getAccessEmailFromPayload_(payload);
  if (!email || !isUelEmail_(email)) {
    return null;
  }

  return findUsuarioByEmail_(email);
}

function isUelEmail_(email) {
  return normalizeEmail_(email).endsWith(UEL_DOMAIN);
}

function normalizeEmail_(email) {
  return String(email || '')
    .trim()
    .replace(/\u200B/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .toLowerCase();
}

function normalizeAccessProfile_(profile) {
  const value = String(profile || '').trim().toUpperCase();
  return ACCESS_PROFILE_VALUES.indexOf(value) >= 0 ? value : '';
}

function success_(data) {
  return {
    success: true,
    data: data,
    error: null
  };
}

function accessError_(code, message) {
  return {
    success: false,
    data: null,
    error: {
      code: code,
      message: message
    }
  };
}

function appendAccessLog_(status, message, referenceType, referenceId, payload) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    appendSyncLog_(spreadsheet, status, message, payload || {});
  } catch (error) {
    Logger.log(error);
  }
}

function appendSecurityLog_(action, message, referenceType, referenceId, payload) {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('sync_logs');
    if (!sheet) {
      return;
    }

    sheet.appendRow([
      'LOG-' + Utilities.getUuid(),
      'WEB',
      action,
      'SUCESSO',
      referenceType || '',
      referenceId || '',
      message || '',
      JSON.stringify(payload || {}),
      now_()
    ]);
  } catch (error) {
    Logger.log(error);
  }
}
