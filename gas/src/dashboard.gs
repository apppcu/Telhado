// @version:1.0.0

const DASHBOARD_ADMIN_PROFILES = ['ADMIN'];

function getDashboardData(payload) {
  try {
    const user = getAuthorizedUserFromPayload_(payload);

    if (!user) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.');
    }

    const active = isTrue_(user.ativo);
    if (!active) {
      return accessError_('USUARIO_PENDENTE', 'Usuario ainda aguarda aprovacao.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const chamados = getChamadosDashboard_(spreadsheet);
    const canManageAccess = canManageAccess_(user);
    const pendencias = canManageAccess ? getPendingAccessRequests_(spreadsheet) : [];
    const meusChamados = getMeusChamadosDashboard_(chamados, user);
    const chamadosMetricas = canManageAccess ? chamados : meusChamados;

    return success_({
      user: user,
      metrics: buildDashboardMetrics_(chamadosMetricas, pendencias),
      weather: getWeatherDashboard_(),
      chamados: canManageAccess ? chamados.slice(0, 8) : [],
      meusChamados: meusChamados.slice(0, 12),
      pendingAccess: canManageAccess ? pendencias : [],
      canManageAccess: canManageAccess
    });
  } catch (error) {
    return accessError_('DASHBOARD_ERROR', error.message);
  }
}

function getChamadosDashboard_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('chamados');
  const rows = readSheetObjects_(sheet);
  const tecnicosById = getTecnicosByIdForDashboard_(spreadsheet);

  return rows
    .map(function(row) {
      const executanteId = row.executante_id || '';
      const tecnico = tecnicosById[executanteId] || null;
      return {
        id: row.id || '',
        numero: row.numero || row.id || '-',
        centro_sigla: row.centro_sigla || '-',
        predio_id: row.predio_id || '-',
        solicitante_id: row.solicitante_id || '',
        descricao: row.descricao || '',
        categoria: row.categoria || '',
        prioridade: row.prioridade || 'NORMAL',
        status: row.status || 'ABERTO',
        executante_id: executanteId,
        executante_nome: tecnico ? tecnico.nome : '',
        data_abertura: row.data_abertura || row.created_at || ''
      };
    })
    .sort(function(a, b) {
      return dateValue_(b.data_abertura) - dateValue_(a.data_abertura);
    });
}

function getMeusChamadosDashboard_(chamados, user) {
  const userId = String(user.id || '').trim();
  const email = normalizeEmail_(user.email);

  return chamados.filter(function(chamado) {
    const solicitante = String(chamado.solicitante_id || '').trim();
    return solicitante === userId || normalizeEmail_(solicitante) === email;
  });
}

function getTecnicosByIdForDashboard_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('tecnicos');
  if (!sheet) {
    return {};
  }

  return readSheetObjects_(sheet).reduce(function(map, tecnico) {
    if (tecnico.id) {
      map[tecnico.id] = tecnico;
    }
    return map;
  }, {});
}

function getPendingAccessRequests_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('usuarios');
  const rows = readSheetObjects_(sheet);

  return rows
    .filter(function(row) {
      return !isTrue_(row.ativo);
    })
    .map(function(row) {
      return {
        nome: row.nome || '-',
        email: row.email || '',
        perfil: row.perfil || 'USUARIO',
        centro_sigla: row.centro_sigla || '-',
        telefone: row.telefone || '',
        created_at: row.created_at || ''
      };
    })
    .sort(function(a, b) {
      return dateValue_(b.created_at) - dateValue_(a.created_at);
    });
}

function buildDashboardMetrics_(chamados, pendencias) {
  const metrics = {
    abertos: 0,
    em_analise: 0,
    em_execucao: 0,
    encaminhados: 0,
    concluidos: 0,
    alertas_chuva: 0,
    pendencias_acesso: pendencias.length
  };

  chamados.forEach(function(chamado) {
    const status = normalizeStatus_(chamado.status);

    if (status === 'CONCLUIDO') {
      metrics.concluidos++;
      return;
    }

    if (status === 'EM_ANALISE') {
      metrics.em_analise++;
      return;
    }

    if (status === 'ENCAMINHADO') {
      metrics.encaminhados++;
      return;
    }

    if (status === 'EM_EXECUCAO') {
      metrics.em_analise++;
      metrics.em_execucao++;
      return;
    }

    if (status === 'ALERTA_CHUVA' || status === 'REINCIDENCIA') {
      metrics.alertas_chuva++;
      return;
    }

    if (status === 'ABERTO') {
      metrics.abertos++;
      return;
    }

    // Compatibilidade com estados legados/inesperados.
    metrics.abertos++;
  });

  return metrics;
}

function getWeatherDashboard_() {
  try {
    const data = consultarClimaDiario();
    const days = buildWeatherDays_(data);
    const maxRain = days.reduce(function(max, day) {
      return Math.max(max, day.precipitation_mm);
    }, 0);
    const current = buildWeatherCurrent_(data, days);
    const threshold = Number(CONFIG.CHUVA_THRESHOLD_MM || 5);

    return {
      available: true,
      city: 'Londrina/PR',
      threshold_mm: threshold,
      max_precipitation_mm: maxRain,
      current_temperature_c: current.temperature_c,
      current_condition: current.condition,
      current_icon: current.icon,
      risk: weatherRisk_(maxRain, threshold),
      days: days
    };
  } catch (error) {
    return {
      available: false,
      city: 'Londrina/PR',
      threshold_mm: Number(CONFIG.CHUVA_THRESHOLD_MM || 5),
      max_precipitation_mm: 0,
      current_temperature_c: null,
      current_condition: 'Indisponivel',
      current_icon: 'cloud',
      risk: 'INDISPONIVEL',
      days: [],
      message: error.message
    };
  }
}

function buildWeatherCurrent_(data, days) {
  const current = data && data.current ? data.current : {};
  const temperature = current.temperature_2m;
  const code = Number(current.weather_code);
  const todayRain = days && days.length ? Number(days[0].precipitation_mm || 0) : 0;
  const condition = weatherCondition_(code, todayRain);

  return {
    temperature_c: temperature === null || temperature === undefined || temperature === '' ? null : Number(temperature),
    condition: condition.label,
    icon: condition.icon
  };
}

function weatherCondition_(code, todayRain) {
  if (todayRain >= 5 || (code >= 61 && code <= 82) || (code >= 95 && code <= 99)) {
    return { label: 'Chuva prevista', icon: 'rain' };
  }

  if (todayRain > 0 || (code >= 51 && code <= 57)) {
    return { label: 'Instavel', icon: 'cloud-rain' };
  }

  if (code === 0 || code === 1) {
    return { label: 'Tempo aberto', icon: 'sun' };
  }

  return { label: 'Nublado', icon: 'cloud' };
}

function buildWeatherDays_(data) {
  const daily = data && data.daily ? data.daily : {};
  const dates = daily.time || [];
  const precipitation = daily.precipitation_sum || [];

  return dates.slice(0, 4).map(function(date, index) {
    return {
      date: date,
      label: weatherDayLabel_(date, index),
      precipitation_mm: Number(precipitation[index] || 0)
    };
  });
}

function weatherDayLabel_(date, index) {
  if (index === 0) {
    return 'Hoje';
  }
  if (index === 1) {
    return 'Amanha';
  }

  return Utilities.formatDate(new Date(date + 'T12:00:00'), CONFIG.TIMEZONE, 'dd/MM');
}

function weatherRisk_(maxRain, threshold) {
  if (maxRain >= threshold * 2) {
    return 'CRITICO';
  }
  if (maxRain >= threshold) {
    return 'ATENCAO';
  }
  return 'BAIXO';
}

function canManageAccess_(user) {
  const profile = String(user.perfil || '').trim().toUpperCase();
  return DASHBOARD_ADMIN_PROFILES.indexOf(profile) >= 0;
}

function normalizeStatus_(status) {
  return String(status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function dateValue_(value) {
  const time = new Date(value).getTime();
  return isNaN(time) ? 0 : time;
}
