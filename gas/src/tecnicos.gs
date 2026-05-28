const TECNICOS_SCHEMA = [
  'id',
  'nome',
  'email',
  'telefone',
  'especialidade',
  'ativo',
  'created_at',
  'updated_at',
  'login',
  'senha_hash',
  'senha_temporaria',
  'trocar_senha',
  'ultimo_login',
  'token_sessao',
  'token_expira_em'
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
    const login = normalizeTecnicoLogin_(data.login || email || telefone);

    if (!nome) {
      return accessError_('NOME_TECNICO_OBRIGATORIO', 'Informe o nome do tecnico.');
    }

    if (!login) {
      return accessError_('LOGIN_TECNICO_OBRIGATORIO', 'Informe um login para o tecnico.');
    }

    if (email && !isValidEmail_(email)) {
      return accessError_('EMAIL_TECNICO_INVALIDO', 'Informe um e-mail valido ou deixe em branco.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getTecnicosSheet_(spreadsheet);
    const existing = findTecnicoRowByLoginOrEmail_(sheet, login, email);
    const now = now_();
    const temporaryPassword = gerarSenhaTemporariaTecnico_();
    const passwordHash = hashTecnicoPassword_(temporaryPassword);

    if (existing) {
      const index = headerIndex_(existing.headers);
      sheet.getRange(existing.rowNumber, index.nome + 1).setValue(nome);
      sheet.getRange(existing.rowNumber, index.telefone + 1).setValue(telefone);
      sheet.getRange(existing.rowNumber, index.especialidade + 1).setValue(especialidade);
      sheet.getRange(existing.rowNumber, index.ativo + 1).setValue(true);
      sheet.getRange(existing.rowNumber, index.updated_at + 1).setValue(now);
      sheet.getRange(existing.rowNumber, index.login + 1).setValue(login);
      sheet.getRange(existing.rowNumber, index.senha_hash + 1).setValue(passwordHash);
      sheet.getRange(existing.rowNumber, index.senha_temporaria + 1).setValue(true);
      sheet.getRange(existing.rowNumber, index.trocar_senha + 1).setValue(true);
      sheet.getRange(existing.rowNumber, index.token_sessao + 1).setValue('');
      sheet.getRange(existing.rowNumber, index.token_expira_em + 1).setValue('');
      appendSecurityLog_('CADASTRAR_TECNICO', 'Tecnico atualizado/reativado.', 'TECNICO', existing.values[index.id] || email, {
        tecnico_email: email,
        login: login,
        atualizado_por: admin.email || ''
      });
      const tecnico = buildTecnicoFromValues_(existing.headers, sheet.getRange(existing.rowNumber, 1, 1, existing.headers.length).getValues()[0]);
      tecnico.senha_temporaria_valor = temporaryPassword;
      return success_(tecnico);
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
      now,
      login,
      passwordHash,
      true,
      true,
      '',
      '',
      ''
    ]);
    appendSecurityLog_('CADASTRAR_TECNICO', 'Tecnico cadastrado.', 'TECNICO', tecnicoId, {
      tecnico_email: email,
      login: login,
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
      updated_at: now,
      login: login,
      senha_temporaria: true,
      trocar_senha: true,
      senha_temporaria_valor: temporaryPassword
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

function gerarNovaSenhaTemporariaTecnico(payload) {
  try {
    const data = payload || {};
    const admin = getAuthorizedUserFromPayload_(data);
    if (!isActiveAdmin_(admin)) {
      return accessError_('ADMIN_NAO_AUTORIZADO', 'Apenas administradores podem gerar senha de tecnicos.');
    }

    const tecnicoId = String(data.tecnico_id || '').trim();
    if (!tecnicoId) {
      return accessError_('TECNICO_ID_OBRIGATORIO', 'Informe o tecnico para gerar nova senha.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getTecnicosSheet_(spreadsheet);
    const location = findTecnicoRowById_(sheet, tecnicoId);
    if (!location) {
      return accessError_('TECNICO_NAO_ENCONTRADO', 'Tecnico nao encontrado.');
    }

    const index = headerIndex_(location.headers);
    const temporaryPassword = gerarSenhaTemporariaTecnico_();
    const now = now_();

    sheet.getRange(location.rowNumber, index.senha_hash + 1).setValue(hashTecnicoPassword_(temporaryPassword));
    sheet.getRange(location.rowNumber, index.senha_temporaria + 1).setValue(true);
    sheet.getRange(location.rowNumber, index.trocar_senha + 1).setValue(true);
    sheet.getRange(location.rowNumber, index.token_sessao + 1).setValue('');
    sheet.getRange(location.rowNumber, index.token_expira_em + 1).setValue('');
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);
    appendSecurityLog_('GERAR_SENHA_TECNICO', 'Nova senha temporaria gerada.', 'TECNICO', tecnicoId, {
      gerado_por: admin.email || ''
    });

    return success_({
      id: tecnicoId,
      senha_temporaria_valor: temporaryPassword,
      trocar_senha: true,
      updated_at: now
    });
  } catch (error) {
    return accessError_('GERAR_SENHA_TECNICO_ERROR', error.message);
  }
}

function loginTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const login = normalizeTecnicoLogin_(data.login);
    const senha = String(data.senha || data.password || '');

    if (!login || !senha) {
      return accessError_('LOGIN_INVALIDO', 'Login ou senha invalidos.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getTecnicosSheet_(spreadsheet);
    const location = findTecnicoRowByLogin_(sheet, login);

    if (!location) {
      return accessError_('LOGIN_INVALIDO', 'Login ou senha invalidos.');
    }

    const index = headerIndex_(location.headers);
    const row = location.values;
    const active = String(row[index.ativo]).toUpperCase() === 'TRUE' || row[index.ativo] === true;
    const expectedHash = String(row[index.senha_hash] || '');
    const receivedHash = hashTecnicoPassword_(senha);

    if (!active || !expectedHash || expectedHash !== receivedHash) {
      return accessError_('LOGIN_INVALIDO', 'Login ou senha invalidos.');
    }

    const now = now_();
    const token = 'MOB-' + Utilities.getUuid();
    const expiresAt = Utilities.formatDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");

    sheet.getRange(location.rowNumber, index.ultimo_login + 1).setValue(now);
    sheet.getRange(location.rowNumber, index.token_sessao + 1).setValue(token);
    sheet.getRange(location.rowNumber, index.token_expira_em + 1).setValue(expiresAt);

    appendSecurityLog_('LOGIN_TECNICO_MOBILE', 'Login mobile de tecnico.', 'TECNICO', row[index.id] || '', {
      login: login
    });

    return success_({
      token: token,
      token_expira_em: expiresAt,
      trocar_senha: String(row[index.trocar_senha]).toUpperCase() === 'TRUE' || row[index.trocar_senha] === true,
      tecnico: {
        id: row[index.id] || '',
        nome: row[index.nome] || '',
        email: row[index.email] || '',
        telefone: row[index.telefone] || '',
        especialidade: row[index.especialidade] || '',
        login: row[index.login] || ''
      }
    });
  } catch (error) {
    return accessError_('LOGIN_TECNICO_ERROR', error.message);
  }
}

function trocarSenhaTecnicoMobile(payload) {
  try {
    const data = payload || {};
    const token = String(data.token || '').trim();
    const novaSenha = String(data.nova_senha || data.senha || data.password || '');

    if (!token) {
      return accessError_('TOKEN_OBRIGATORIO', 'Sessao invalida. Entre novamente.');
    }

    const passwordValidation = validarSenhaTecnico_(novaSenha);
    if (!passwordValidation.ok) {
      return accessError_('SENHA_INVALIDA', passwordValidation.message);
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = getTecnicosSheet_(spreadsheet);
    const location = findTecnicoRowByToken_(sheet, token);

    if (!location) {
      return accessError_('SESSAO_INVALIDA', 'Sessao expirada. Entre novamente.');
    }

    const index = headerIndex_(location.headers);
    const row = location.values;
    const active = String(row[index.ativo]).toUpperCase() === 'TRUE' || row[index.ativo] === true;

    if (!active) {
      return accessError_('TECNICO_INATIVO', 'Tecnico inativo.');
    }

    const now = now_();
    sheet.getRange(location.rowNumber, index.senha_hash + 1).setValue(hashTecnicoPassword_(novaSenha));
    sheet.getRange(location.rowNumber, index.senha_temporaria + 1).setValue(false);
    sheet.getRange(location.rowNumber, index.trocar_senha + 1).setValue(false);
    sheet.getRange(location.rowNumber, index.updated_at + 1).setValue(now);

    appendSecurityLog_('TROCAR_SENHA_TECNICO_MOBILE', 'Senha de tecnico alterada no primeiro acesso.', 'TECNICO', row[index.id] || '', {
      login: row[index.login] || ''
    });

    return success_({
      token: token,
      token_expira_em: row[index.token_expira_em] || '',
      trocar_senha: false,
      tecnico: {
        id: row[index.id] || '',
        nome: row[index.nome] || '',
        email: row[index.email] || '',
        telefone: row[index.telefone] || '',
        especialidade: row[index.especialidade] || '',
        login: row[index.login] || ''
      }
    });
  } catch (error) {
    return accessError_('TROCAR_SENHA_TECNICO_ERROR', error.message);
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
        login: row.login || '',
        senha_temporaria: row.senha_temporaria,
        trocar_senha: row.trocar_senha,
        ultimo_login: row.ultimo_login || '',
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
        especialidade: rows[i].especialidade || '',
        login: rows[i].login || ''
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
    updated_at: values[index.updated_at] || '',
    login: values[index.login] || '',
    senha_temporaria: values[index.senha_temporaria],
    trocar_senha: values[index.trocar_senha],
    ultimo_login: values[index.ultimo_login] || ''
  };
}

function findTecnicoRowByLoginOrEmail_(sheet, login, email) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const targetLogin = normalizeTecnicoLogin_(login);
  const targetEmail = normalizeEmail_(email);

  for (var i = 0; i < values.length; i++) {
    const currentLogin = normalizeTecnicoLogin_(values[i][index.login]);
    const currentEmail = normalizeEmail_(values[i][index.email]);
    if ((targetLogin && currentLogin === targetLogin) || (targetEmail && currentEmail === targetEmail)) {
      return {
        rowNumber: i + 2,
        headers: headers,
        values: values[i]
      };
    }
  }

  return null;
}

function findTecnicoRowByLogin_(sheet, login) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const targetLogin = normalizeTecnicoLogin_(login);

  for (var i = 0; i < values.length; i++) {
    if (normalizeTecnicoLogin_(values[i][index.login]) === targetLogin) {
      return {
        rowNumber: i + 2,
        headers: headers,
        values: values[i]
      };
    }
  }

  return null;
}

function findTecnicoRowByToken_(sheet, token) {
  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headerIndex_(headers);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const target = String(token || '').trim();
  const now = new Date();

  for (var i = 0; i < values.length; i++) {
    const currentToken = String(values[i][index.token_sessao] || '').trim();
    const expiresAt = values[i][index.token_expira_em] ? new Date(values[i][index.token_expira_em]) : null;
    const tokenActive = !expiresAt || isNaN(expiresAt.getTime()) || expiresAt >= now;

    if (currentToken && currentToken === target && tokenActive) {
      return {
        rowNumber: i + 2,
        headers: headers,
        values: values[i]
      };
    }
  }

  return null;
}

function gerarSenhaTemporariaTecnico_() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '0123456789';
  let password = '';

  for (var i = 0; i < 3; i++) {
    password += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  for (var j = 0; j < 3; j++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return password;
}

function validarSenhaTecnico_(password) {
  const value = String(password || '');

  if (value.length < 6) {
    return {
      ok: false,
      message: 'A senha precisa ter pelo menos 6 caracteres.'
    };
  }

  if (!/[A-Z]/.test(value)) {
    return {
      ok: false,
      message: 'A senha precisa ter pelo menos uma letra maiuscula.'
    };
  }

  if (!/[0-9]/.test(value)) {
    return {
      ok: false,
      message: 'A senha precisa ter pelo menos um numero.'
    };
  }

  return {
    ok: true,
    message: ''
  };
}

function hashTecnicoPassword_(password) {
  const salt = String(CONFIG.SPREADSHEET_ID || 'SISTEMA_TELHADOS');
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + String(password || ''), Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function normalizeTecnicoLogin_(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail_(email));
}

function isActiveAdmin_(user) {
  const active = user && (String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true);
  return active && canManageAccess_(user);
}
