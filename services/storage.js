'use strict';

const fs = require('fs');
const path = require('path');

const CFG = require('../config/config');

const SEQUENCE_DIR = path.join(CFG.DATA_DIR, 'sequence');
const CAPTURE_DIR = path.join(CFG.DATA_DIR, 'captures');
const SEQUENCE_FILE = path.join(SEQUENCE_DIR, 'current.json');
const CAPTURE_INDEX = path.join(CAPTURE_DIR, 'index.jsonl');

const PENDING_CAPTURES = new WeakMap();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function loadSequence() {
  const saved = readJson(SEQUENCE_FILE, null);
  if (!saved || !Array.isArray(saved.queue)) return null;
  return saved;
}

function saveSequence(seq) {
  writeJsonAtomic(SEQUENCE_FILE, {
    queue: seq.queue || [],
    running: !!seq.running,
    paused: !!seq.paused,
    currentIndex: Number(seq.currentIndex) || -1,
    frameInItem: Number(seq.frameInItem) || 0,
    doneFrames: Number(seq.doneFrames) || 0,
    totalFrames: Number(seq.totalFrames) || 0,
    awaitingFrame: !!seq.awaitingFrame,
    status: seq.status || 'Pronto',
    savedAt: new Date().toISOString(),
  });
}

function rememberPendingCapture(session, meta = {}) {
  PENDING_CAPTURES.set(session, {
    source: meta.source || 'manual',
    target: cleanPart(meta.target || 'Alvo'),
    type: cleanPart(meta.type || 'Light'),
    exposure: Number(meta.exposure) || null,
    gain: Number(meta.gain) || null,
    filterSlot: meta.filterSlot || null,
    sequenceItemId: meta.sequenceItemId || null,
    createdAt: new Date().toISOString(),
  });
}

function takePendingCapture(session) {
  const meta = PENDING_CAPTURES.get(session) || null;
  PENDING_CAPTURES.delete(session);
  return meta;
}

function saveCameraFrame({ data, format, meta }) {
  if (!meta || !data) return null;

  const now = new Date();
  const dateDir = localDate(now);
  const target = cleanPart(meta.target || 'Alvo');
  const type = cleanPart(meta.type || 'Light');
  const ext = cleanPart(format || 'fits').replace(/^jpeg$/, 'jpg') || 'fits';
  const dir = path.join(CAPTURE_DIR, dateDir, target, type);
  const fileName = [
    timeStamp(now),
    type,
    meta.exposure ? `${meta.exposure}s` : null,
    meta.gain != null ? `g${meta.gain}` : null,
    meta.filterSlot ? `f${meta.filterSlot}` : null,
  ].filter(Boolean).join('_') + `.${ext}`;
  const filePath = path.join(dir, fileName);

  ensureDir(dir);
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));

  const record = {
    path: filePath,
    relativePath: path.relative(CFG.DATA_DIR, filePath),
    fileName,
    format: ext,
    size: fs.statSync(filePath).size,
    ...meta,
    savedAt: now.toISOString(),
  };

  ensureDir(CAPTURE_DIR);
  fs.appendFileSync(CAPTURE_INDEX, JSON.stringify(record) + '\n');
  return record;
}

function cleanPart(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'item';
}

function localDate(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function timeStamp(d) {
  return [
    localDate(d),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('-');
}

module.exports = {
  loadSequence,
  saveSequence,
  rememberPendingCapture,
  takePendingCapture,
  saveCameraFrame,
};
