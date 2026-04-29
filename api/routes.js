'use strict';

const express  = require('express');
const crypto   = require('crypto');
const { spawn, exec } = require('child_process');
const path     = require('path');

const router = express.Router();

/* ─────────────────────────────────────────────
   CONFIG (vem do server principal)
   ───────────────────────────────────────────── */

let CFG;
let TOKENS;

/* Inicialização (injeção de dependências) */
function initRoutes(config, tokensStore) {
  CFG    = config;
  TOKENS = tokensStore;
}

/* ─────────────────────────────────────────────
   UTIL
   ───────────────────────────────────────────── */

const sh = (cmd) => new Promise(resolve =>
  exec(cmd, { timeout: 5000 }, (_, out) => resolve((out || '').trim()))
);

/* ─────────────────────────────────────────────
   AUTH — TERMINAL
   ───────────────────────────────────────────── */

/**
 * POST /api/auth/terminal
 * Body: { user, password }
 */
router.post('/auth/terminal', (req, res) => {
  const { user, password } = req.body || {};

  if (!user || !password) {
    return res.status(400).json({
      error: 'user e password obrigatórios'
    });
  }

  const child = spawn('su', ['-c', 'exit 0', user], {
    stdio: ['pipe', 'ignore', 'ignore'],
  });

  child.stdin.write(password + '\n');
  child.stdin.end();

  child.on('close', (code) => {
    if (code !== 0) {
      return res.status(401).json({
        error: 'Credenciais inválidas'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    TOKENS.set(token, {
      user,
      exp: Date.now() + CFG.TOKEN_TTL_MS
    });

    setTimeout(() => {
      TOKENS.delete(token);
    }, CFG.TOKEN_TTL_MS);

    res.json({
      token,
      ttl: CFG.TOKEN_TTL_MS
    });
  });
});

/* ─────────────────────────────────────────────
   AUTH VERIFY
   ───────────────────────────────────────────── */

router.get('/auth/verify', (req, res) => {
  const token = req.query.token;
  const t = TOKENS.get(token);

  if (!t || t.exp < Date.now()) {
    return res.status(401).end();
  }

  res.json({ user: t.user });
});

/* ─────────────────────────────────────────────
   SERIAL PORTS
   ───────────────────────────────────────────── */

router.get('/ports', async (req, res) => {
  try {
    const out = await sh(
      'ls /dev/ttyUSB* /dev/ttyACM* /dev/ttyAMA* 2>/dev/null'
    );

    const ports = out.split('\n').filter(Boolean);

    res.json({ ports });

  } catch (e) {
    res.json({ ports: [] });
  }
});

/* ─────────────────────────────────────────────
   FALLBACK SPA (index.html)
   ───────────────────────────────────────────── */

function setupFallback(app, publicDir) {
  app.get('*', (_, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

/* ─────────────────────────────────────────────
   EXPORTS
   ───────────────────────────────────────────── */

module.exports = {
  router,
  initRoutes,
  setupFallback,
};