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
    const email = getAccessEmailFromPayload_(payload);

    if (!email) {
      return success_({
        email: '',
        domainAllowed: false,
        accessState: ACCESS_STATES.UNKNOWN_EMAIL,
        user: null
      });
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

    const active = String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true;
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
      usuarioAtivo: user ? (String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true) : false,
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
    const email = normalizeEmail_(data.email || getCurrentUserEmail_());
    const nome = String(data.nome || '').trim();
    const telefone = String(data.telefone || '').trim();
    const centroSigla = String(data.centro_sigla || '').trim().toUpperCase();
    const observacao = String(data.observacao || '').trim();

    if (!nome) {
      return accessError_('NOME_OBRIGATORIO', 'Informe o nome para solicitar acesso.');
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
        accessState: String(existing.ativo).toUpperCase() === 'TRUE' ? ACCESS_STATES.ACTIVE : ACCESS_STATES.PENDING,
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
    const adminActive = admin && (String(admin.ativo).toUpperCase() === 'TRUE' || admin.ativo === true);

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
    const adminActive = admin && (String(admin.ativo).toUpperCase() === 'TRUE' || admin.ativo === true);

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

    return success_({
      email: email,
      rejeitado: true
    });
  } catch (error) {
    return accessError_('REJEITAR_ACESSO_ERROR', error.message);
  }
}

function getCentrosAtivos() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('centros');
    const rows = readSheetObjects_(sheet);
    const centros = rows
      .filter(function(row) {
        return String(row.ativo).toUpperCase() === 'TRUE' || row.ativo === true;
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
    const active = String(row.ativo).toUpperCase() === 'TRUE' || row.ativo === true;
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

function getAccessEmailFromPayload_(payload) {
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
  return String(email || '').trim().toLowerCase();
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
