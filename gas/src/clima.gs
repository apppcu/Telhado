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

