'use strict';

/* Envia mensagem WS */
function emit(ws, type, data) {
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify({ type, ...data }));
    } catch {}
  }
}

/* Log padronizado */
function log(ws, level, text) {
  emit(ws, 'log', { level, text });
}

module.exports = {
  emit,
  log,
};