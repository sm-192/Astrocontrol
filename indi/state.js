'use strict';

/* ══════════════════════════════════════════════
   ESTADO GLOBAL DE DISPOSITIVOS (FIEL)
   ══════════════════════════════════════════════ */

const DEVICE_STATE = {
  mount: {
    connected: false, state: 'disconnected',
    ra: null, dec: null, ra_raw: null, dec_raw: null,
    alt: null, az: null,
    tracking: null, parked: false, slewing: false,
    slewRate: null, pierSide: null,
  },
  camera: {
    connected: false, state: 'disconnected',
    exposure: null, gain: null, capturing: false,
  },
  focuser: {
    connected: false, state: 'disconnected',
    position: null, moving: false,
  },
  filterwheel: {
    connected: false, state: 'disconnected',
    slot: null, filter: null, filterNames: [],
  },
  rotator: {
    connected: false, state: 'disconnected',
    angle: null, moving: false,
  },
  gps: {
    connected: false, state: 'disconnected',
    lat: null, lon: null, fix: false, sats: 0,
  },
};

/* ══════════════════════════════════════════════
   MAPA DE DISPOSITIVOS INDI
   ══════════════════════════════════════════════ */

const KNOWN_DEVICES = new Map();

/* ══════════════════════════════════════════════
   DETECÇÃO DE TIPO DE DISPOSITIVO
   ══════════════════════════════════════════════ */

function deviceKey(name) {
  if (!name) return null;

  const n = name.toLowerCase();

  if (n.includes('telescope') || n.includes('eqmod') || n.includes('mount') ||
      n.includes('lx200') || n.includes('nexstar') || n.includes('ontrack') ||
      n.includes('eq') || n.includes('synscan')) return 'mount';

  if (n.includes('ccd') || n.includes('camera') || n.includes('canon') ||
      n.includes('nikon') || n.includes('asi') || n.includes('qhy') ||
      n.includes('sv305') || n.includes('atik')) return 'camera';

  if (n.includes('focuser') || n.includes('moonlite') ||
      n.includes('robofocus') || n.includes('esatto') ||
      n.includes('primaluce')) return 'focuser';

  if (n.includes('filter') || n.includes('efw') || n.includes('cfwl'))
    return 'filterwheel';

  if (n.includes('rotat')) return 'rotator';

  if (n.includes('gps') || n.includes('gpsd')) return 'gps';

  return null;
}

/* ══════════════════════════════════════════════
   PATCH DE ESTADO
   ══════════════════════════════════════════════ */

function patchDevice(key, patch) {
  if (DEVICE_STATE[key]) {
    Object.assign(DEVICE_STATE[key], patch);
  }
}

/* ══════════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════════ */

module.exports = {
  DEVICE_STATE,
  KNOWN_DEVICES,
  deviceKey,
  patchDevice,
};