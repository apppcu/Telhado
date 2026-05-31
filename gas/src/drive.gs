const FOTO_TIPOS_PERMITIDOS = ['VISTORIA_ANTES', 'CONCLUSAO'];
const FOTO_MIME_TYPE = 'image/jpeg';
const FOTO_MAX_BYTES = 6 * 1024 * 1024;

function salvarFoto(payload) {
  try {
    const data = payload || {};
    const context = getChamadoTecnicoMobileContext_(data, 'enviar foto');
    if (!context.ok) {
      return context.error;
    }

    const tipo = String(data.tipo || '').trim().toUpperCase();
    const contentBase64 = String(data.content_base64 || '').trim();
    const mimeType = String(data.mime_type || FOTO_MIME_TYPE).trim().toLowerCase();

    if (FOTO_TIPOS_PERMITIDOS.indexOf(tipo) < 0) {
      return accessError_('TIPO_FOTO_INVALIDO', 'Tipo de foto nao permitido.');
    }

    if (!contentBase64) {
      return accessError_('FOTO_OBRIGATORIA', 'Envie o conteudo da foto.');
    }

    if (mimeType !== FOTO_MIME_TYPE) {
      return accessError_('FORMATO_FOTO_INVALIDO', 'Envie uma foto JPEG valida.');
    }

    if (estimateBase64Bytes_(contentBase64) > FOTO_MAX_BYTES) {
      return accessError_('FOTO_MUITO_GRANDE', 'A foto deve ter no maximo 6 MB.');
    }

    const numero = String(context.row[context.index.numero] || context.chamadoId);
    const bytes = Utilities.base64Decode(contentBase64);
    if (!isJpegBytes_(bytes)) {
      return accessError_('FORMATO_FOTO_INVALIDO', 'Envie uma foto JPEG valida.');
    }
    const folder = getChamadoFotoFolder_(numero, tipo);
    const safeName = buildFotoFileName_(numero, tipo);
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

function buildFotoFileName_(numero, tipo) {
  const timestamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd-HHmmss');
  return String(numero || 'chamado') + '-' + tipo + '-' + timestamp + '.jpg';
}

function estimateBase64Bytes_(contentBase64) {
  const value = String(contentBase64 || '').replace(/\s/g, '');
  const padding = value.endsWith('==') ? 2 : (value.endsWith('=') ? 1 : 0);
  return Math.floor(value.length * 3 / 4) - padding;
}

function isJpegBytes_(bytes) {
  if (!bytes || bytes.length < 3) {
    return false;
  }

  return unsignedByte_(bytes[0]) === 0xFF &&
    unsignedByte_(bytes[1]) === 0xD8 &&
    unsignedByte_(bytes[2]) === 0xFF;
}

function unsignedByte_(value) {
  return value < 0 ? value + 256 : value;
}
