'use strict';

/**
 * INTERPRETER INDI (100% fiel ao parseIndiMessage)
 */

const {
  DEVICE_STATE,
  KNOWN_DEVICES,
  deviceKey,
  patchDevice,
} = require('../indi/state');

const {
  xAttr,
  xChildren,
} = require('./parser');

const {
  emit,
  log,
} = require('../utils/helpers');

const {
  formatRA,
  formatDec,
} = require('../utils/coords');

/* ───────────────────────────────────────────── */

function parseIndiMessage(xml, tag, session) {

  const ws     = session.ws;
  const device = xAttr(xml, 'device');
  const name   = xAttr(xml, 'name');
  const state  = xAttr(xml, 'state');

  const key = device
    ? (KNOWN_DEVICES.get(device) || deviceKey(device))
    : null;

  if (device && key && !KNOWN_DEVICES.has(device)) {
    KNOWN_DEVICES.set(device, key);
  }

  switch (tag) {

    /* ───────── NUMBER ───────── */

    case 'defNumberVector':
    case 'setNumberVector': {

      const nums = {};

      for (const el of xChildren(xml, 'oneNumber', 'defNumber')) {
        const v = parseFloat(el.value !== '' ? el.value : (el['_value'] || '0'));
        if (!isNaN(v)) nums[el.name] = v;
      }

      if (name === 'EQUATORIAL_EOD_COORD' || name === 'EQUATORIAL_COORD') {
        const ra = nums['RA'];
        const dec = nums['DEC'];

        if (ra != null && dec != null) {
          patchDevice('mount', {
            ra: formatRA(ra),
            dec: formatDec(dec),
            ra_raw: ra,
            dec_raw: dec,
            slewing: state === 'Busy',
            state: state === 'Busy'
              ? 'slewing'
              : DEVICE_STATE.mount.tracking ? 'tracking' : 'idle',
          });

          emit(ws, 'device_update', {
            key: 'mount',
            data: DEVICE_STATE.mount
          });
        }
      }

      break;
    }

    /* ───────── SWITCH ───────── */

    case 'defSwitchVector':
    case 'setSwitchVector': {

      const switches = {};

      for (const el of xChildren(xml, 'oneSwitch', 'defSwitch')) {
        switches[el.name] = el.value === 'On';
      }

      if (name === 'CONNECTION' && key) {
        const connected = switches['CONNECT'] === true;

        patchDevice(key, {
          connected,
          state: connected ? 'idle' : 'disconnected'
        });

        emit(ws, 'device_update', {
          key,
          data: DEVICE_STATE[key]
        });

        log(ws, connected ? 'ok' : 'wn',
          `${device || key} ${connected ? 'conectado' : 'desconectado'}`
        );
      }

      break;
    }

    /* ───────── MESSAGE ───────── */

    case 'message': {
      const txt = xAttr(xml, 'message');
      const ts  = xAttr(xml, 'timestamp');

      if (txt && txt.trim()) {
        log(ws, 'dim', `[${ts || '--'}] ${txt}`);
      }
      break;
    }

    /* ───────── REMOVE ───────── */

    case 'delProperty': {
      if (key) {
        KNOWN_DEVICES.delete(device);
        patchDevice(key, { connected: false, state: 'disconnected' });

        emit(ws, 'device_update', {
          key,
          data: DEVICE_STATE[key]
        });
      }
      break;
    }
  }
}

module.exports = {
  parseIndiMessage,
};