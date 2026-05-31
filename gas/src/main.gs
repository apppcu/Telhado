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
    .setTitle('Sistema de Manutencao de Telhados');
}

function doGetApi(e) {
  return handleGet(e);
}

function doPost(e) {
  if (getParam_(e, 'action') === 'confirmar_validacao_pos_chuva') {
    return responderValidacaoPosChuva(
      getParam_(e, 'token'),
      getParam_(e, 'resposta')
    );
  }

  return handlePost(e);
}

