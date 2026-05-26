function doGet(e) {
  if (getParam_(e, 'action')) {
    return handleGet(e);
  }

  return renderWebApp_();
}

function renderWebApp_() {
  return HtmlService
    .createTemplateFromFile('src/index')
    .evaluate()
    .setTitle('Sistema de Manutencao de Telhados')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGetApi(e) {
  return handleGet(e);
}

function doPost(e) {
  return handlePost(e);
}

