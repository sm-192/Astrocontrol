/**
 * AstroControl — app.js  (production)
 *
 * Estado central → render via rAF
 * WebSocket com backoff e heartbeat
 * Fila de comandos offline
 * Auth segura do terminal via POST
 */

'use strict';

/* ══════════════════════════════════════════════
   ESTADO CENTRAL
   ══════════════════════════════════════════════ */

const STATE = {
  wsConnected:   false,
  indiConnected: false,
  devices: {
    mount:       { connected:false, state:'disconnected', ra:null, dec:null, alt:null, az:null, tracking:null, parked:false, slewing:false },
    camera:      { connected:false, state:'disconnected', exposure:null, gain:null, capturing:false },
    focuser:     { connected:false, state:'disconnected', position:null, moving:false },
    filterwheel: { connected:false, state:'disconnected', slot:null, filter:null, filterNames:[] },
    rotator:     { connected:false, state:'disconnected', angle:null },
    gps:         { connected:false, state:'disconnected', lat:null, lon:null, fix:false, sats:0 },
  },
  currentTab:  'mount',
  slewRate:    16,
  tracking:    null,
  gotoStatus:  null,
  network:     { mode:'--', ip:'--', ssid:'--', signal:'--', ap_active:false, ap_clients:0, services:{} },
  drivers:     [],
  indiserver:  false,
  logs:        [],
};

/* Render agendado */
let rafPending = false;

function setState(patch) {
  deepMerge(STATE, patch);
  scheduleRender();
}

function deepMerge(target, src) {
  for (const k of Object.keys(src)) {
    if (src[k] !== null && typeof src[k] === 'object' && !Array.isArray(src[k])
        && target[k] !== null && typeof target[k] === 'object') {
      deepMerge(target[k], src[k]);
    } else {
      target[k] = src[k];
    }
  }
}

function scheduleRender() {
  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(render);
  }
}

/* ══════════════════════════════════════════════
   RENDER
   ══════════════════════════════════════════════ */

function render() {
  rafPending = false;

  /* Status dots topbar */
  setDot('pi',   STATE.wsConnected);
  setDot('indi', STATE.indiConnected);
  setDot('gps',  STATE.devices.gps.fix, !STATE.devices.gps.fix && STATE.devices.gps.sats > 0);
  setDot('ap',   STATE.network.ap_active);

  if (STATE.currentTab === 'mount')   renderMount();
  if (STATE.currentTab === 'drivers') renderDrivers();
  if (STATE.currentTab === 'network') renderNetwork();

  renderGotoStatus();
}

function renderMount() {
  const m = STATE.devices.mount;
  setText('m-ra',  m.ra  || '--');
  setText('m-dec', m.dec || '--');
  setText('m-alt', m.alt != null ? m.alt + '°' : '--');
  setText('m-az',  m.az  != null ? m.az  + '°' : '--');

  /* Badge de estado */
  const badge = $('mount-state-badge');
  if (badge) {
    const labels = {
      disconnected:'Desconectado', idle:'Pronto',
      tracking:'Rastreando', slewing:'Slewing…',
      parked:'Park', error:'Erro',
    };
    badge.textContent = labels[m.state] || m.state;
    badge.className   = 'mount-badge mount-badge-' + (m.state || 'disconnected');
  }

  /* Botões de tracking */
  document.querySelectorAll('.trk button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === STATE.tracking);
  });
}

function renderDrivers() {
  const DRIVER_KEYS = {
    mount:'indi_eqmod_telescope', camera:'indi_canon_ccd',
    focuser:'indi_moonlite', filterwheel:'indi_efw',
    rotator:'indi_simulator_rotator', gps:'indi_gpsd',
  };

  Object.entries(DRIVER_KEYS).forEach(([key]) => {
    const dev = STATE.devices[key];
    if (!dev) return;
    const dot = $('dot-' + key);
    const tog = $('tog-' + key);
    if (dot) dot.className = 'dot ' +
      (dev.state === 'error' ? 'dr' : dev.connected ? 'dg' : dev.state !== 'disconnected' ? 'da' : 'dx');
    if (tog) tog.classList.toggle('on', dev.connected);
  });

  /* Log */
  const logEl = $('indi-log');
  if (logEl && logEl.dataset.logLen !== String(STATE.logs.length)) {
    const frag = document.createDocumentFragment();
    STATE.logs.forEach(({ level, text }) => {
      const div  = document.createElement('div');
      const span = document.createElement('span');
      span.className   = level;
      span.textContent = level === 'ok' ? '[OK]' : level === 'er' ? '[ER]' : level === 'wn' ? '[--]' : '[..]';
      div.appendChild(span);
      div.appendChild(document.createTextNode(' ' + text));
      frag.appendChild(div);
    });
    logEl.innerHTML = '';
    logEl.appendChild(frag);
    logEl.scrollTop = logEl.scrollHeight;
    logEl.dataset.logLen = STATE.logs.length;
  }
}

function renderNetwork() {
  const n = STATE.network;
  setText('net-mode',   n.mode);
  setText('net-ip',     n.ip);
  setText('net-ssid',   n.ssid);
  setText('net-signal', n.signal);

  const tog = $('ap-tog');
  const sub = $('ap-sub');
  const inf = $('ap-info');
  if (tog) tog.classList.toggle('on', n.ap_active);
  if (sub) sub.textContent = n.ap_active
    ? `Ativo · AstroPi · ${n.ap_clients} cliente(s)`
    : 'Desativado · sobe automaticamente sem WiFi';
  if (inf) inf.style.opacity = n.ap_active ? '1' : '0.3';
  setText('ap-clients', String(n.ap_clients));

  Object.entries(n.services || {}).forEach(([k, up]) => {
    const dot = $('svc-dot-' + k);
    if (dot) dot.className = 'dot ' + (up ? 'dg' : 'dx');
  });
}

function renderGotoStatus() {
  const el = $('goto-status');
  if (!el) return;
  if (!STATE.gotoStatus) { el.textContent = ''; return; }
  const { success, message } = STATE.gotoStatus;
  el.style.color = success === null ? '#EF9F27' : success ? '#5DCAA5' : '#E24B4A';
  el.textContent = (success === null ? '⟳ ' : success ? '✓ ' : '✗ ') + message;
}

function setDot(id, on, warn) {
  const el = $('st-' + id);
  if (!el) return;
  const dot = el.querySelector('.dot');
  if (dot) dot.className = 'dot ' + (on ? 'dg' : warn ? 'da' : 'dx');
}

/* ══════════════════════════════════════════════
   WEBSOCKET — BACKEND
   ══════════════════════════════════════════════ */

const WS_HOST = window.location.hostname || 'astropi.local';
const WS_PORT = parseInt(window.location.port) || 3000;
const WS_URL  = `ws://${WS_HOST}:${WS_PORT}/ws`;

let ws         = null;
let wsBackoff  = 1000;
let wsTimer    = null;
let wsAlive    = false;
let hbTimer    = null;
const CMD_QUEUE = [];

function connectWS() {
  clearTimeout(wsTimer);
  try { ws = new WebSocket(WS_URL); }
  catch {
    setState({ wsConnected: false });
    wsTimer = setTimeout(connectWS, wsBackoff);
    wsBackoff = Math.min(wsBackoff * 1.5, 30000);
    return;
  }

  ws.onopen = () => {
    wsBackoff = 1000;
    wsAlive   = true;
    setState({ wsConnected: true });
    startHeartbeat();
    flushCmdQueue();
    sendWS({ type: 'get_state' });
    sendWS({ type: 'network_status' });
    addLog('ok', 'Bridge conectado');
  };

  ws.onmessage = (evt) => {
    try { handleServerMsg(JSON.parse(evt.data)); } catch {}
  };

  ws.onerror = () => {};

  ws.onclose = () => {
    stopHeartbeat();
    setState({ wsConnected: false, indiConnected: false });
    addLog('wn', `Offline — reconecta em ${Math.round(wsBackoff / 1000)}s`);
    wsTimer = setTimeout(connectWS, wsBackoff);
    wsBackoff = Math.min(wsBackoff * 1.5, 30000);
  };
}

function sendWS(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

function sendCmd(msg, queueIfOffline = true) {
  if (!sendWS(msg) && queueIfOffline) {
    CMD_QUEUE.push(msg);
    addLog('wn', `Na fila: ${msg.type}`);
  }
}

function flushCmdQueue() {
  while (CMD_QUEUE.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
    addLog('ok', `Reenviado: ${CMD_QUEUE[0].type}`);
    sendWS(CMD_QUEUE.shift());
  }
}

function startHeartbeat() {
  stopHeartbeat();
  hbTimer = setInterval(() => {
    if (!wsAlive) { ws && ws.close(); return; }
    wsAlive = false;
    sendWS({ type: 'ping', ts: Date.now() });
  }, 15000);
}

function stopHeartbeat() { clearInterval(hbTimer); }

/* ══════════════════════════════════════════════
   HANDLER DE MENSAGENS DO SERVIDOR
   ══════════════════════════════════════════════ */

function handleServerMsg(msg) {
  wsAlive = true;

  switch (msg.type) {
    case 'pong': break;

    case 'full_state':
      if (msg.devices) setState({ devices: msg.devices });
      break;

    case 'device_update':
      if (msg.key && STATE.devices[msg.key]) {
        STATE.devices[msg.key] = { ...STATE.devices[msg.key], ...msg.data };
        /* Propaga GPS para alignment.js */
        if (msg.key === 'gps' && typeof applyAlignData === 'function') {
          const gps = STATE.devices.gps;
          if (gps.lat && gps.lon) {
            applyAlignData({ lat: gps.lat, lon: gps.lon, fix: gps.fix, sats: gps.sats });
          }
        }
        scheduleRender();
      }
      break;

    case 'indi_status':
      setState({ indiConnected: !!msg.connected });
      if (!msg.connected) {
        Object.keys(STATE.devices).forEach(k => {
          STATE.devices[k].connected = false;
          STATE.devices[k].state     = 'disconnected';
        });
        scheduleRender();
      }
      break;

    case 'driver_status':
      setState({ indiserver: !!msg.indiserver, drivers: msg.drivers || [] });
      if (msg.drivers) {
        msg.drivers.forEach(d => {
          const key = driverNameToKey(d.name);
          if (key && STATE.devices[key]) {
            STATE.devices[key].connected = d.connected;
            STATE.devices[key].state     = d.error ? 'error' : d.connected ? 'idle' : 'disconnected';
          }
        });
        scheduleRender();
      }
      break;

    case 'goto_result':
      setState({ gotoStatus: { success: msg.success, message: msg.message } });
      if (msg.success !== null) setTimeout(() => setState({ gotoStatus: null }), 8000);
      break;

    case 'network':
      // eslint-disable-next-line no-unused-vars
      (function() {
        const { type: _t, ...net } = msg;
        setState({ network: net });
      })();
      break;

    case 'log':
      addLog(msg.level, msg.text);
      break;
  }
}

function driverNameToKey(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('eqmod') || n.includes('telescope') || n.includes('mount')) return 'mount';
  if (n.includes('ccd')   || n.includes('camera')    || n.includes('canon')) return 'camera';
  if (n.includes('moonlite') || n.includes('focuser'))                        return 'focuser';
  if (n.includes('efw')   || n.includes('filter'))                            return 'filterwheel';
  if (n.includes('rotat'))                                                     return 'rotator';
  if (n.includes('gps'))                                                       return 'gps';
  return null;
}

function addLog(level, text) {
  STATE.logs.push({ level, text });
  if (STATE.logs.length > 200) STATE.logs.splice(0, STATE.logs.length - 200);
  if (STATE.currentTab === 'drivers') scheduleRender();
}

/* ══════════════════════════════════════════════
   WEBSOCKET — SENSORES (Python bridge)
   ══════════════════════════════════════════════ */

const SENSOR_PORT = 8765;
let sensorWs      = null;
let sensorBackoff = 2000;

function connectSensors() {
  try { sensorWs = new WebSocket(`ws://${WS_HOST}:${SENSOR_PORT}`); }
  catch { setTimeout(connectSensors, sensorBackoff); return; }

  sensorWs.onopen = () => {
    sensorBackoff = 2000;
    setDot('gps', false, true); /* amarelo = conectado mas sem fix ainda */
    if (typeof updateSensorBanner === 'function') updateSensorBanner(true);
  };

  sensorWs.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      /* data = { pitch, roll, heading, lat, lon, decMag, fix, sats } */
      if (typeof applyAlignData === 'function') applyAlignData(data);
      setDot('gps', data.fix, !data.fix && (data.sats || 0) > 0);
    } catch {}
  };

  sensorWs.onclose = () => {
    setDot('gps', false);
    if (typeof updateSensorBanner === 'function') updateSensorBanner(false);
    sensorBackoff = Math.min(sensorBackoff * 1.5, 30000);
    setTimeout(connectSensors, sensorBackoff);
  };
}

/* ══════════════════════════════════════════════
   NAVEGAÇÃO
   ══════════════════════════════════════════════ */

function sw(id, el) {
  document.querySelectorAll('.panel, .novnc-panel').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const panel = $('p-' + id);
  if (panel) { panel.style.display = 'flex'; panel.classList.add('active'); }
  if (el)    el.classList.add('active');

  STATE.currentTab = id;
  scheduleRender();

  if (id === 'align')   { if (typeof renderAlign === 'function') renderAlign(); }
  if (id === 'network') sendCmd({ type: 'network_status' }, false);
  if (id === 'drivers') sendCmd({ type: 'get_state' }, false);
}

/* ══════════════════════════════════════════════
   MONTAGEM
   ══════════════════════════════════════════════ */

function setRate(el, rate) {
  document.querySelectorAll('.rb').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  STATE.slewRate = rate;
  sendCmd({ type: 'slew_rate', rate });
}

function jp(dir) {
  $('j' + dir)?.classList.add('pr');
  sendCmd({ type: 'slew_start', direction: dir, rate: STATE.slewRate });
}

function jr(dir) {
  $('j' + dir)?.classList.remove('pr');
  sendCmd({ type: 'slew_stop', direction: dir });
}

function jStop() {
  ['N','S','E','W'].forEach(d => {
    $('j' + d)?.classList.remove('pr');
    sendCmd({ type: 'slew_stop', direction: d }, false);
  });
}

function setTrk(el, mode) {
  document.querySelectorAll('.trk button').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  STATE.tracking = mode === 'None' ? null : mode;
  sendCmd({ type: 'tracking', mode });
}

function doGotoName() {
  const name = ($('goto-name')?.value || '').trim();
  if (!name) return;
  setState({ gotoStatus: { success: null, message: `Resolvendo "${name}"…` } });
  sendCmd({ type: 'goto_name', name });
}

function doGotoCoords() {
  const ra  = ($('goto-ra')?.value  || '').trim();
  const dec = ($('goto-dec')?.value || '').trim();
  if (!ra || !dec) return;
  sendCmd({ type: 'goto_coords', ra, dec });
}

function syncMount()  { sendCmd({ type: 'sync' }); }
function parkMount()  { sendCmd({ type: 'park' }); }

/* ══════════════════════════════════════════════
   DRIVERS
   ══════════════════════════════════════════════ */

const DRIVER_MAP = {
  mount:       'indi_eqmod_telescope',
  camera:      'indi_canon_ccd',
  focuser:     'indi_moonlite',
  filterwheel: 'indi_efw',
  rotator:     'indi_simulator_rotator',
  gps:         'indi_gpsd',
  adxl:        'python_bridge',
};

function toggleDriver(key) {
  const tog  = $('tog-' + key);
  if (!tog) return;
  const willOn = !tog.classList.contains('on');
  sendCmd({ type: willOn ? 'driver_start' : 'driver_stop', driver: DRIVER_MAP[key] || key });
}

/* ══════════════════════════════════════════════
   noVNC / TERMINAL
   ══════════════════════════════════════════════ */

function connectVNC(frameId, statusId, port) {
  const frame  = $(frameId);
  const status = $(statusId);
  if (!frame) return;
  const url = `http://${WS_HOST}:${port}/vnc_lite.html?autoconnect=1&reconnect=1&resize=scale`;
  frame.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;background:#000" allow="fullscreen"></iframe>`;
  if (status) status.textContent = 'Conectado';
}

function showAuth(type) {
  const box = $('auth-' + type);
  if (box) box.style.display = 'block';
}

async function doAuth(type) {
  const errEl = $('err-' + type);
  if (errEl) errEl.textContent = '';

  if (type === 'terminal') {
    const user = ($('user-terminal')?.value || '').trim();
    const pwd  = $('pwd-terminal')?.value || '';
    if (!user || !pwd) { if (errEl) errEl.textContent = 'Preencha usuário e senha.'; return; }

    try {
      const res = await fetch(`http://${WS_HOST}:${WS_PORT}/api/auth/terminal`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user, password: pwd }),
      });
      if (!res.ok) { if (errEl) errEl.textContent = 'Credenciais inválidas.'; return; }
      const { token } = await res.json();

      const frame  = $('term-frame');
      const status = $('term-status');
      /* Token como query param — backend valida via /api/auth/verify */
      frame.innerHTML = `<iframe src="http://${WS_HOST}:7681/?token=${token}" style="width:100%;height:100%;border:none;background:#000" allow="fullscreen"></iframe>`;
      if (status) status.textContent = 'Conectado';
    } catch (e) {
      if (errEl) errEl.textContent = 'Erro: ' + e.message;
    }

  } else if (type === 'desktop') {
    const pwd = $('pwd-desktop')?.value || '';
    if (!pwd) { if (errEl) errEl.textContent = 'Digite a senha VNC.'; return; }
    const frame  = $('vnc-d-frame');
    const status = $('vnc-d-status');
    const url = `http://${WS_HOST}:6082/vnc_lite.html?autoconnect=1&reconnect=1&resize=scale&password=${encodeURIComponent(pwd)}`;
    frame.innerHTML = `<iframe src="${url}" style="width:100%;height:100%;border:none;background:#000" allow="fullscreen"></iframe>`;
    if (status) status.textContent = 'Conectado';
  }
}

/* ══════════════════════════════════════════════
   REDE
   ══════════════════════════════════════════════ */

function toggleAP() {
  sendCmd({ type: 'ap_toggle', enable: !STATE.network.ap_active });
}

/* ══════════════════════════════════════════════
   RELÓGIO UTC
   ══════════════════════════════════════════════ */

function tickClock() {
  const d  = new Date();
  const el = $('utc');
  if (el) {
    el.textContent =
      String(d.getUTCHours()).padStart(2,'0')   + ':' +
      String(d.getUTCMinutes()).padStart(2,'0') + ':' +
      String(d.getUTCSeconds()).padStart(2,'0') + ' UTC';
  }
  requestAnimationFrame(tickClock);
}

/* ══════════════════════════════════════════════
   UTILITÁRIOS
   ══════════════════════════════════════════════ */

function $(id)        { return document.getElementById(id); }
function setText(id, t) { const e = $(id); if (e && e.textContent !== t) e.textContent = t; }

/* ══════════════════════════════════════════════
   SERVICE WORKER
   ══════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */

document.querySelectorAll('.panel, .novnc-panel').forEach(p => {
  if (!p.classList.contains('active')) p.style.display = 'none';
});

connectWS();
connectSensors();
requestAnimationFrame(tickClock);
scheduleRender();