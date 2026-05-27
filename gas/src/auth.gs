// @version:1.0.0

const UEL_DOMAIN = '@uel.br';
const ACCESS_STATES = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  NOT_REGISTERED: 'NOT_REGISTERED',
  DOMAIN_DENIED: 'DOMAIN_DENIED',
  UNKNOWN_EMAIL: 'UNKNOWN_EMAIL'
};

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
    const perfilSolicitado = String(data.perfil_solicitado || 'VISUALIZACAO').trim().toUpperCase();
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
      'VISUALIZACAO',
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
      perfil_solicitado: perfilSolicitado,
      observacao: observacao
    });

    return success_({
      accessState: ACCESS_STATES.PENDING,
      user: {
        nome: nome,
        email: email,
        perfil: 'VISUALIZACAO',
        centro_sigla: centroSigla,
        ativo: false
      }
    });
  } catch (error) {
    appendAccessLog_('ERRO', error.message, 'USUARIO', '', {});
    return accessError_('REGISTRO_ACESSO_ERROR', error.message);
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
