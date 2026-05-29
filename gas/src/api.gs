function handleGet(e) {
  const action = getParam_(e, 'action');

  if (action === 'chamados') {
    return jsonResponse_({ success: true, data: listarChamados(), error: null });
  }

  if (action === 'dashboard') {
    return jsonResponse_(getDashboardData());
  }

  if (action === 'historico_chamado') {
    return jsonResponse_(getHistoricoChamado(getParam_(e, 'id')));
  }

  if (action === 'validar_pos_chuva') {
    return responderValidacaoPosChuva(getParam_(e, 'token'), getParam_(e, 'resposta'));
  }

  if (action === 'config') {
    return jsonResponse_({ success: true, data: { timezone: CONFIG.TIMEZONE }, error: null });
  }

  return jsonError_('ROTA_NAO_ENCONTRADA', 'Rota GET nao encontrada.');
}

function handlePost(e) {
  const body = parseJsonBody_(e);
  const action = body.action;

  if (action === 'sync') {
    return jsonResponse_({ success: true, data: processarSync(body.items || []), error: null });
  }

  if (action === 'criar_chamado') {
    return jsonResponse_(criarChamado(body.payload || body));
  }

  if (action === 'atualizar_chamado') {
    return jsonResponse_(atualizarChamado(body.payload || body));
  }

  if (action === 'login_tecnico_mobile') {
    return jsonResponse_(loginTecnicoMobile(body.payload || body));
  }

  if (action === 'trocar_senha_tecnico_mobile') {
    return jsonResponse_(trocarSenhaTecnicoMobile(body.payload || body));
  }

  if (action === 'listar_chamados_tecnico_mobile') {
    return jsonResponse_(listarChamadosTecnicoMobile(body.payload || body));
  }

  if (action === 'iniciar_vistoria_tecnico_mobile') {
    return jsonResponse_(iniciarVistoriaTecnicoMobile(body.payload || body));
  }

  if (action === 'salvar_vistoria_tecnico_mobile') {
    return jsonResponse_(salvarVistoriaTecnicoMobile(body.payload || body));
  }

  if (action === 'iniciar_reparo_tecnico_mobile') {
    return jsonResponse_(iniciarReparoTecnicoMobile(body.payload || body));
  }

  if (action === 'reabrir_vistoria_tecnico_mobile') {
    return jsonResponse_(reabrirVistoriaTecnicoMobile(body.payload || body));
  }

  if (action === 'concluir_reparo_tecnico_mobile') {
    return jsonResponse_(concluirReparoTecnicoMobile(body.payload || body));
  }

  if (action === 'upload_foto') {
    return jsonResponse_(salvarFoto(body.payload || body));
  }

  return jsonError_('ROTA_NAO_ENCONTRADA', 'Rota POST nao encontrada.');
}

