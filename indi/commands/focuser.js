'use strict';

const { indiWrite } = require('../connection');
const { KNOWN_DEVICES } = require('../state');

function focuserDev() {
  for (const [name, key] of KNOWN_DEVICES) {
    if (key === 'focuser') return name;
  }
  return 'Focuser Simulator';
}

function indiFocusMove(session, steps) {
  const dev = focuserDev();

  const dir = steps >= 0 ? 'FOCUS_OUTWARD' : 'FOCUS_INWARD';
  const abs = Math.abs(steps);

  indiWrite(session,
    `<newSwitchVector device="${dev}" name="FOCUS_MOTION">` +
    `<oneSwitch name="${dir}">On</oneSwitch>` +
    `</newSwitchVector>`
  );

  indiWrite(session,
    `<newNumberVector device="${dev}" name="REL_FOCUS_POSITION">` +
    `<oneNumber name="FOCUS_RELATIVE_POSITION">${abs}</oneNumber>` +
    `</newNumberVector>`
  );
}

function indiFocusStop(session) {
  indiWrite(session,
    `<newSwitchVector device="${focuserDev()}" name="FOCUS_ABORT_MOTION">` +
    `<oneSwitch name="ABORT">On</oneSwitch>` +
    `</newSwitchVector>`
  );
}

function indiFocusGoto(session, pos) {
  indiWrite(session,
    `<newNumberVector device="${focuserDev()}" name="ABS_FOCUS_POSITION">` +
    `<oneNumber name="FOCUS_ABSOLUTE_POSITION">${Math.round(pos)}</oneNumber>` +
    `</newNumberVector>`
  );
}

module.exports = {
  indiFocusMove,
  indiFocusStop,
  indiFocusGoto,
};