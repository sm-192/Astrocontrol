'use strict';

const { exec } = require('child_process');

/* Exec shell com promise */
function sh(cmd, timeout = 5000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout }, (_, out) => {
      resolve((out || '').trim());
    });
  });
}

module.exports = {
  sh,
};