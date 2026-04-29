'use strict';

const { indiWrite } = require('../connection');
const { KNOWN_DEVICES } = require('../state');

function filterwheelDev() {
  for (const [name, key] of KNOWN_DEVICES) {
    if (key === 'filterwheel') return name;
  }
  return 'Filter Wheel Simulator';
}

function indiFilterSet(session, slot) {
  indiWrite(session,
    `<newNumberVector device="${filterwheelDev()}" name="FILTER_SLOT">` +
    `<oneNumber name="FILTER_SLOT_VALUE">${slot}</oneNumber>` +
    `</newNumberVector>`
  );
}

module.exports = {
  indiFilterSet,
};