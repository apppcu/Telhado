const API_MAX_BODY_CHARS = 9 * 1024 * 1024;

function isTrue_(value) {
  return value === true || String(value || '').trim().toUpperCase() === 'TRUE';
}

function normalizeLowerText_(value) {
  return String(value || '').trim().toLowerCase();
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(code, message) {
  return jsonResponse_({
    success: false,
    data: null,
    error: { code: code, message: message }
  });
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const contents = String(e.postData.contents || '');
  if (contents.length > API_MAX_BODY_CHARS) {
    throw new Error('Payload excede o limite permitido.');
  }

  return JSON.parse(contents);
}

function getParam_(e, name) {
  if (!e || !e.parameter) {
    return '';
  }
  return e.parameter[name] || '';
}

