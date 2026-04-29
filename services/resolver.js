'use strict';

const http = require('http');
const CFG = require('../config/config');

function resolveObject(name) {
  return new Promise((resolve, reject) => {

    const url = `http://cdsweb.u-strasbg.fr/cgi-bin/nph-sesame/-ox?${encodeURIComponent(name)}`;

    const req = http.get(url, { timeout: CFG.SESAME_TIMEOUT_MS }, (res) => {
      let data = '';

      res.on('data', c => data += c);

      res.on('end', () => {
        const ram  = data.match(/<jradeg>([\d.]+)<\/jradeg>/);
        const decm = data.match(/<jdedeg>([+-]?[\d.]+)<\/jdedeg>/);

        if (ram && decm) {
          resolve({
            ra: parseFloat(ram[1]) / 15,
            dec: parseFloat(decm[1])
          });
        } else {
          reject(new Error(`Objeto não encontrado: ${name}`));
        }
      });
    });

    req.on('error', reject);

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout Sesame: ${name}`));
    });

  });
}

module.exports = {
  resolveObject,
};