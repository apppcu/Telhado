// @version:1.0.0

const DASHBOARD_ADMIN_PROFILES = ['ADMIN'];

function getDashboardData(payload) {
  try {
    const user = getAuthorizedUserFromPayload_(payload);

    if (!user) {
      return accessError_('USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado.');
    }

    const active = String(user.ativo).toUpperCase() === 'TRUE' || user.ativo === true;
    if (!active) {
      return accessError_('USUARIO_PENDENTE', 'Usuario ainda aguarda aprovacao.');
    }

    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const chamados = getChamadosDashboard_(spreadsheet);
    const pendencias = canManageAccess_(user) ? getPendingAccessRequests_(spreadsheet) : [];

    return success_({
      user: user,
      metrics: buildDashboardMetrics_(chamados, pendencias),
      weather: getWeatherDashboard_(),
      chamados: chamados.slice(0, 8),
      pendingAccess: pendencias.slice(0, 6),
      canManageAccess: canManageAccess_(user)
    });
  } catch (error) {
    return accessError_('DASHBOARD_ERROR', error.message);
  }
}

function getChamadosDashboard_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('chamados');
  const rows = readSheetObjects_(sheet);

  return rows
    .map(function(row) {
      return {
        id: row.id || '',
        numero: row.numero || row.id || '-',
        centro_sigla: row.centro_sigla || '-',
        predio_id: row.predio_id || '-',
        descricao: row.descricao || '',
        prioridade: row.prioridade || 'NORMAL',
        status: row.status || 'ABERTO',
        executante_id: row.executante_id || '',
        data_abertura: row.data_abertura || row.created_at || ''
      };
    })
    .sort(function(a, b) {
      return dateValue_(b.data_abertura) - dateValue_(a.data_abertura);
    });
}

function getPendingAccessRequests_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('usuarios');
  const rows = readSheetObjects_(sheet);

  return rows
    .filter(function(row) {
      return !(String(row.ativo).toUpperCase() === 'TRUE' || row.ativo === true);
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
    em_execucao: 0,
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

    if (status === 'EM_EXECUCAO') {
      metrics.em_execucao++;
      return;
    }

    if (status === 'ALERTA_CHUVA' || status === 'REINCIDENCIA') {
      metrics.alertas_chuva++;
      return;
    }

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
    const threshold = Number(CONFIG.CHUVA_THRESHOLD_MM || 5);

    return {
      available: true,
      city: 'Londrina/PR',
      threshold_mm: threshold,
      max_precipitation_mm: maxRain,
      risk: weatherRisk_(maxRain, threshold),
      days: days
    };
  } catch (error) {
    return {
      available: false,
      city: 'Londrina/PR',
      threshold_mm: Number(CONFIG.CHUVA_THRESHOLD_MM || 5),
      max_precipitation_mm: 0,
      risk: 'INDISPONIVEL',
      days: [],
      message: error.message
    };
  }
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
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function dateValue_(value) {
  const time = new Date(value).getTime();
  return isNaN(time) ? 0 : time;
}
