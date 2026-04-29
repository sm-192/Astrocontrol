'use strict';

const { indiWrite } = require('../connection');
const { KNOWN_DEVICES, patchDevice } = require('../state');

function cameraDev() {
  for (const [name, key] of KNOWN_DEVICES) {
    if (key === 'camera') return name;
  }
  return 'CCD Simulator';
}

function indiCameraCapture(session, exposure, gain) {
  const dev = cameraDev();

  if (gain != null) {
    indiWrite(session,
      `<newNumberVector device="${dev}" name="CCD_GAIN">` +
      `<oneNumber name="GAIN">${gain}</oneNumber>` +
      `</newNumberVector>`
    );
  }

  indiWrite(session,
    `<newNumberVector device="${dev}" name="CCD_EXPOSURE">` +
    `<oneNumber name="CCD_EXPOSURE_VALUE">${parseFloat(exposure).toFixed(3)}</oneNumber>` +
    `</newNumberVector>`
  );

  patchDevice('camera', { capturing: true });
}

function indiCameraAbort(session) {
  indiWrite(session,
    `<newSwitchVector device="${cameraDev()}" name="CCD_ABORT_EXPOSURE">` +
    `<oneSwitch name="ABORT">On</oneSwitch>` +
    `</newSwitchVector>`
  );

  patchDevice('camera', { capturing: false });
}

module.exports = {
  indiCameraCapture,
  indiCameraAbort,
};