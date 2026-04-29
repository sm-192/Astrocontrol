'use strict';

const { indiWrite } = require('../connection');
const { DEVICE_STATE, KNOWN_DEVICES } = require('../state');

/* Resolve nome do dispositivo */
function mountDev() {
  for (const [name, key] of KNOWN_DEVICES) {
    if (key === 'mount') return name;
  }
  return 'Telescope Simulator';
}

function indiSlew(session, dir, start) {
  const isNS = dir === 'N' || dir === 'S';
  const prop = isNS ? 'TELESCOPE_MOTION_NS' : 'TELESCOPE_MOTION_WE';

  const mot = {
    N:'MOTION_NORTH',
    S:'MOTION_SOUTH',
    W:'MOTION_WEST',
    E:'MOTION_EAST'
  };

  const opp = {
    N:'MOTION_SOUTH',
    S:'MOTION_NORTH',
    W:'MOTION_EAST',
    E:'MOTION_WEST'
  };

  indiWrite(session,
    `<newSwitchVector device="${mountDev()}" name="${prop}">` +
    `<oneSwitch name="${mot[dir]}">${start?'On':'Off'}</oneSwitch>` +
    `<oneSwitch name="${opp[dir]}">Off</oneSwitch>` +
    `</newSwitchVector>`
  );
}

function indiSlewRate(session, rate) {
  const tiers = [
    { max:2, n:'SLEW_GUIDE' },
    { max:8, n:'SLEW_CENTERING' },
    { max:16, n:'SLEW_FIND' },
    { max:Infinity, n:'SLEW_MAX' },
  ];

  const chosen = tiers.find(t => rate <= t.max).n;

  const sw = tiers
    .map(t => `<oneSwitch name="${t.n}">${t.n===chosen?'On':'Off'}</oneSwitch>`)
    .join('');

  indiWrite(session,
    `<newSwitchVector device="${mountDev()}" name="TELESCOPE_SLEW_RATE">${sw}</newSwitchVector>`
  );
}

function indiGoto(session, ra, dec, id) {
  const dev = mountDev();

  indiWrite(session,
    `<newSwitchVector device="${dev}" name="ON_COORD_SET">` +
    `<oneSwitch name="TRACK">On</oneSwitch>` +
    `<oneSwitch name="SLEW">Off</oneSwitch>` +
    `<oneSwitch name="SYNC">Off</oneSwitch>` +
    `</newSwitchVector>`,
    id ? id+'_mode' : undefined
  );

  indiWrite(session,
    `<newNumberVector device="${dev}" name="EQUATORIAL_EOD_COORD">` +
    `<oneNumber name="RA">${ra.toFixed(6)}</oneNumber>` +
    `<oneNumber name="DEC">${dec.toFixed(6)}</oneNumber>` +
    `</newNumberVector>`,
    id
  );
}

function indiSync(session) {
  const dev = mountDev();

  indiWrite(session,
    `<newSwitchVector device="${dev}" name="ON_COORD_SET">` +
    `<oneSwitch name="SYNC">On</oneSwitch>` +
    `<oneSwitch name="TRACK">Off</oneSwitch>` +
    `<oneSwitch name="SLEW">Off</oneSwitch>` +
    `</newSwitchVector>`
  );

  const { ra_raw: ra, dec_raw: dec } = DEVICE_STATE.mount;

  if (ra != null && dec != null) {
    indiWrite(session,
      `<newNumberVector device="${dev}" name="EQUATORIAL_EOD_COORD">` +
      `<oneNumber name="RA">${ra.toFixed(6)}</oneNumber>` +
      `<oneNumber name="DEC">${dec.toFixed(6)}</oneNumber>` +
      `</newNumberVector>`
    );
  }
}

function indiPark(session, park) {
  indiWrite(session,
    `<newSwitchVector device="${mountDev()}" name="TELESCOPE_PARK">` +
    `<oneSwitch name="${park?'PARK':'UNPARK'}">On</oneSwitch>` +
    `</newSwitchVector>`
  );
}

function indiTracking(session, mode) {
  const dev = mountDev();

  if (mode === 'None') {
    indiWrite(session,
      `<newSwitchVector device="${dev}" name="TELESCOPE_TRACK_STATE">` +
      `<oneSwitch name="TRACK_OFF">On</oneSwitch>` +
      `<oneSwitch name="TRACK_ON">Off</oneSwitch>` +
      `</newSwitchVector>`
    );
    return;
  }

  indiWrite(session,
    `<newSwitchVector device="${dev}" name="TELESCOPE_TRACK_STATE">` +
    `<oneSwitch name="TRACK_ON">On</oneSwitch>` +
    `<oneSwitch name="TRACK_OFF">Off</oneSwitch>` +
    `</newSwitchVector>`
  );

  const mMap = {
    Sidereal:'TRACK_SIDEREAL',
    Solar:'TRACK_SOLAR',
    Lunar:'TRACK_LUNAR'
  };

  const mn = mMap[mode];

  if (mn) {
    const all = ['TRACK_SIDEREAL','TRACK_SOLAR','TRACK_LUNAR','TRACK_CUSTOM'];

    const sw = all
      .map(n => `<oneSwitch name="${n}">${n===mn?'On':'Off'}</oneSwitch>`)
      .join('');

    indiWrite(session,
      `<newSwitchVector device="${dev}" name="TELESCOPE_TRACK_MODE">${sw}</newSwitchVector>`
    );
  }
}

function indiSlewHome(session) {
  indiWrite(session,
    `<newSwitchVector device="${mountDev()}" name="TELESCOPE_HOME">` +
    `<oneSwitch name="GoHome">On</oneSwitch>` +
    `</newSwitchVector>`
  );
}

function indiMeridianFlip(session) {
  indiWrite(session,
    `<newSwitchVector device="${mountDev()}" name="TELESCOPE_MERIDIAN_FLIP">` +
    `<oneSwitch name="FLIP_NOW">On</oneSwitch>` +
    `</newSwitchVector>`
  );
}

module.exports = {
  indiSlew,
  indiSlewRate,
  indiGoto,
  indiSync,
  indiPark,
  indiTracking,
  indiSlewHome,
  indiMeridianFlip,
};