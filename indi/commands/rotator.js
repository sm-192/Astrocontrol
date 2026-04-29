'use strict';

const { indiWrite } = require('../connection');
const { KNOWN_DEVICES } = require('../state');

function rotatorDev() {
  for (const [name, key] of KNOWN_DEVICES) {
    if (key === 'rotator') return name;
  }
  return 'Rotator Simulator';
}

function indiRotatorGoto(session, angle) {
  indiWrite(session,
    `<newNumberVector device="${rotatorDev()}" name="ABS_ROTATOR_ANGLE">` +
    `<oneNumber name="ANGLE">${parseFloat(angle).toFixed(2)}</oneNumber>` +
    `</newNumberVector>`
  );
}

module.exports = {
  indiRotatorGoto,
};