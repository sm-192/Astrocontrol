'use strict';

/* ── FORMAT ── */

function formatRA(h) {
  if (h == null || isNaN(h)) return null;

  const hh = Math.floor(h);
  const mf = (h - hh) * 60;
  const mm = Math.floor(mf);
  const ss = Math.round((mf - mm) * 60);

  return `${hh}h ${String(mm).padStart(2,'0')}m ${String(ss).padStart(2,'0')}s`;
}

function formatDec(d) {
  if (d == null || isNaN(d)) return null;

  const sign = d >= 0 ? '+' : '-';

  const a  = Math.abs(d);
  const dd = Math.floor(a);
  const mf = (a - dd) * 60;
  const mm = Math.floor(mf);
  const ss = Math.round((mf - mm) * 60);

  return `${sign}${dd}° ${String(mm).padStart(2,'0')}' ${String(ss).padStart(2,'0')}"`;
}


/* ── PARSE ── */

function parseRA(s) {
  if (!s) return null;

  s = s.trim();

  if (/^[\d.]+$/.test(s)) return parseFloat(s);

  const m = s.match(/(\d+)\s*[h:]\s*(\d+)\s*[m:]?\s*(\d*\.?\d*)/i);

  if (m) {
    return +m[1] + +m[2]/60 + (+m[3] || 0)/3600;
  }

  return null;
}

function parseDec(s) {
  if (!s) return null;

  s = s.trim();

  if (/^[+-]?[\d.]+$/.test(s)) return parseFloat(s);

  const neg = s[0] === '-';

  const m = s.match(/(\d+)\s*[°d:]\s*(\d+)\s*['"m:]?\s*(\d*\.?\d*)/i);

  if (m) {
    return (neg ? -1 : 1) *
      (+m[1] + +m[2]/60 + (+m[3] || 0)/3600);
  }

  return null;
}

module.exports = {
  formatRA,
  formatDec,
  parseRA,
  parseDec,
};