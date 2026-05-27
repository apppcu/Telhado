function consultarClimaDiario() {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=-23.3045' +
    '&longitude=-51.1696' +
    '&daily=precipitation_sum' +
    '&forecast_days=4' +
    '&timezone=America/Sao_Paulo';

  const response = UrlFetchApp.fetch(url);
  return JSON.parse(response.getContentText());
}

function consultarChuvaObservadaOntem() {
  const ontem = dateKeyOffset_(-1);
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=-23.3045' +
    '&longitude=-51.1696' +
    '&daily=precipitation_sum' +
    '&past_days=1' +
    '&forecast_days=1' +
    '&timezone=America/Sao_Paulo';

  const response = UrlFetchApp.fetch(url);
  const data = JSON.parse(response.getContentText());
  const daily = data && data.daily ? data.daily : {};
  const dates = daily.time || [];
  const precipitation = daily.precipitation_sum || [];
  const index = dates.indexOf(ontem);

  return {
    data_referencia: ontem,
    volume_mm: index >= 0 ? Number(precipitation[index] || 0) : 0,
    raw: data
  };
}

function dateKeyOffset_(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

