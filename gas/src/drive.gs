function salvarFoto(payload) {
  try {
    const data = payload || {};
    const context = getChamadoTecnicoMobileContext_(data, 'enviar foto');
    if (!context.ok) {
      return context.error;
    }

    const tipo = String(data.tipo || '').trim().toUpperCase();
    const contentBase64 = String(data.content_base64 || '').trim();
    const mimeType = String(data.mime_type || 'image/jpeg').trim();
    const originalName = String(data.file_name || 'foto.jpg').trim();

    if (!tipo) {
      return accessError_('TIPO_FOTO_OBRIGATORIO', 'Informe o tipo da foto.');
    }

    if (!contentBase64) {
      return accessError_('FOTO_OBRIGATORIA', 'Envie o conteudo da foto.');
    }

    const numero = String(context.row[context.index.numero] || context.chamadoId);
    const folder = getChamadoFotoFolder_(numero, tipo);
    const bytes = Utilities.base64Decode(contentBase64);
    const safeName = buildFotoFileName_(numero, tipo, originalName);
    const blob = Utilities.newBlob(bytes, mimeType, safeName);
    const file = folder.createFile(blob);
    const now = now_();
    const fotoId = 'FOTO-' + Utilities.getUuid();

    const sheet = context.spreadsheet.getSheetByName('fotos_chamado');
    if (sheet) {
      sheet.appendRow([
        fotoId,
        context.chamadoId,
        file.getId(),
        file.getUrl(),
        tipo,
        'Foto enviada pelo aplicativo mobile.',
        now
      ]);
    }

    registrarLocalizacaoChamadoMobile_(context.spreadsheet, context.chamadoId, context.tecnicoId, 'FOTO_' + tipo, data);

    appendHistoricoChamado_(
      context.spreadsheet,
      context.chamadoId,
      context.tecnicoId,
      'FOTO_ENVIADA',
      '',
      String(context.row[context.index.status] || ''),
      appendObservacaoBloco_(
        'Foto ' + tipo + ' enviada pelo aplicativo mobile.',
        buildLocalizacaoResumoMobile_(data)
      ),
      'MOBILE'
    );

    return success_({
      foto_id: fotoId,
      chamado_id: context.chamadoId,
      drive_file_id: file.getId(),
      drive_url: file.getUrl(),
      tipo: tipo,
      created_at: now
    });
  } catch (error) {
    return accessError_('SALVAR_FOTO_ERROR', error.message);
  }
}

function getChamadoFotoFolder_(numero, tipo) {
  const root = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  const sistema = getOrCreateChildFolder_(root, 'Sistema_Telhados');
  const chamados = getOrCreateChildFolder_(sistema, 'Chamados');
  const chamadoFolder = getOrCreateChildFolder_(chamados, String(numero || 'SEM_NUMERO'));
  const subfolderName = tipo === 'VISTORIA_ANTES' ? 'vistoria' : 'conclusao';
  return getOrCreateChildFolder_(chamadoFolder, subfolderName);
}

function buildFotoFileName_(numero, tipo, originalName) {
  const extensionMatch = String(originalName || '').match(/\.[A-Za-z0-9]+$/);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : '.jpg';
  const timestamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');
  return String(numero || 'chamado') + '-' + tipo + '-' + timestamp + extension;
}
