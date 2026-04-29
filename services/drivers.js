'use strict';

const http = require('http');

const { emit, log } = require('../utils/emit');
const { indiWrite } = require('../indi/connection');
const { KNOWN_DEVICES } = require('../indi/state');

const CFG = require('../config/config');

/* Request helper */
function indiWebReq(method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: CFG.INDIWEB_HOST,
        port: CFG.INDIWEB_PORT,
        path: urlPath,
        method,
        timeout: 5000
      },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch { resolve(d); }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('indiweb timeout'));
    });

    req.end();
  });
}

/* Start driver */
async function startDriver(session, driver, port) {
  const ws = session.ws;

  try {
    await indiWebReq('POST', `/api/server/start/${encodeURIComponent(driver)}`);

    log(ws, 'ok', `Driver: ${driver} iniciado`);

    if (port) {
      log(ws, 'dim', `Configurando porta: ${port}...`);

      const setPort = () => {
        const devName =
          Array.from(KNOWN_DEVICES.entries()).find(([name]) =>
            name === driver || name.toLowerCase().includes(driver.toLowerCase())
          )?.[0] || driver;

        const xml =
          `<newTextVector device="${devName}" name="DEVICE_PORT">` +
          `<oneText name="PORT">${port}</oneText>` +
          `</newTextVector>`;

        indiWrite(session, xml);

        indiWrite(session,
          `<newSwitchVector device="${devName}" name="CONNECTION">` +
          `<oneSwitch name="CONNECT">On</oneSwitch>` +
          `</newSwitchVector>`
        );
      };

      setPort();
      setTimeout(setPort, 3000);
    }

    setTimeout(() => refreshDrivers(ws), 1500);

  } catch (e) {
    log(ws, 'er', `Falha ao iniciar ${driver}: ${e.message}`);
  }
}

/* Stop driver */
async function stopDriver(ws, driver) {
  try {
    await indiWebReq('POST', `/api/server/stop/${encodeURIComponent(driver)}`);

    log(ws, 'wn', `Driver: ${driver} parado`);

    setTimeout(() => refreshDrivers(ws), 1500);

  } catch (e) {
    log(ws, 'er', `Falha ao parar ${driver}: ${e.message}`);
  }
}

/* Status */
async function refreshDrivers(ws) {
  try {
    const data = await indiWebReq('GET', '/api/server/status');

    if (!data || typeof data !== 'object') return;

    emit(ws, 'driver_status', {
      indiserver: data.status === 'running',
      drivers: (data.drivers || []).map(d => ({
        name: d.name || String(d),
        label: d.label || d.name || String(d),
        connected: d.state === 'Running' || d.connected === true,
        error: d.state === 'Error',
        state: d.state || 'unknown',
      }))
    });

  } catch {
    /* silencioso */
  }
}

module.exports = {
  startDriver,
  stopDriver,
  refreshDrivers,
};