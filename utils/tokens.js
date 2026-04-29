/**
 * Token store global (singleton)
 * Mantém compatibilidade 100% com server original
 */

'use strict';

const TOKENS = new Map();

/**
 * Cria token
 */
function createToken(user, ttl) {
  const crypto = require('crypto');

  const token = crypto.randomBytes(32).toString('hex');

  TOKENS.set(token, {
    user,
    exp: Date.now() + ttl,
  });

  // Auto-expiração
  setTimeout(() => TOKENS.delete(token), ttl);

  return token;
}

/**
 * Valida token
 */
function getToken(token) {
  const t = TOKENS.get(token);
  if (!t || t.exp < Date.now()) return null;
  return t;
}

/**
 * Remove token
 */
function deleteToken(token) {
  TOKENS.delete(token);
}

module.exports = {
  TOKENS,
  createToken,
  getToken,
  deleteToken,
};