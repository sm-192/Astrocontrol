'use strict';

/* ══════════════════════════════════════════════
   PARSER STREAMING INDI (100% fiel)
   ══════════════════════════════════════════════ */

const INDI_ROOT_TAGS = [
  'defNumberVector','setNumberVector','newNumberVector',
  'defTextVector','setTextVector','newTextVector',
  'defSwitchVector','setSwitchVector','newSwitchVector',
  'defLightVector','setLightVector',
  'defBLOBVector','setBLOBVector',
  'message','delProperty','getProperties',
];

/* ───────────────────────────────────────────── */

function processIndiBuffer(buffer, onMessage) {
  let pos = 0;

  while (pos < buffer.length) {

    let earliest = -1;
    let foundTag = null;

    for (const tag of INDI_ROOT_TAGS) {
      const needle = '<' + tag;
      let idx = pos;

      while (true) {
        idx = buffer.indexOf(needle, idx);
        if (idx === -1) break;

        const ch = buffer[idx + needle.length];

        if (!ch || ch === ' ' || ch === '\t' || ch === '\n' ||
            ch === '\r' || ch === '>' || ch === '/') {

          if (earliest === -1 || idx < earliest) {
            earliest = idx;
            foundTag = tag;
          }
          break;
        }
        idx += needle.length;
      }
    }

    if (earliest === -1) break;

    let msgEnd = -1;

    const firstGt = buffer.indexOf('>', earliest);
    const selfCloseP = buffer.indexOf('/>', earliest);

    if (firstGt !== -1 && selfCloseP !== -1 && selfCloseP === firstGt - 1) {
      msgEnd = firstGt + 1;
    } else {
      const closeTag = '</' + foundTag + '>';
      const closeIdx = buffer.indexOf(closeTag, earliest);
      if (closeIdx !== -1) {
        msgEnd = closeIdx + closeTag.length;
      }
    }

    if (msgEnd === -1) break;

    const xml = buffer.substring(earliest, msgEnd);

    try {
      onMessage(xml, foundTag);
    } catch (e) {
      console.error('[INDI Parser]', e.message);
    }

    pos = msgEnd;
  }

  return buffer.substring(pos);
}

/* ───────────────────────────────────────────── */

function xAttr(xml, name) {
  const re = new RegExp(name + '\\s*=\\s*(?:"([^"]*?)"|\'([^\']*?)\')');
  const m = re.exec(xml);
  return m ? (m[1] !== undefined ? m[1] : m[2]) : null;
}

function parseIndiAttrs(str) {
  const obj = {};
  const re = /(\w+)\s*=\s*(?:"([^"]*?)"|'([^']*?)')/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    obj[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  return obj;
}

function xChildren(xml, ...tags) {
  const results = [];

  for (const tag of tags) {

    const reOpen = new RegExp(
      '<' + tag + '((?:\\s[^>]*?)?)\\s*>([\\s\\S]*?)<\\/' + tag + '\\s*>', 'g'
    );

    let m;
    while ((m = reOpen.exec(xml)) !== null) {
      const attrs = parseIndiAttrs(m[1]);
      results.push({ ...attrs, value: m[2].trim() });
    }

    const reSelf = new RegExp('<' + tag + '((?:\\s[^>]*?)?)\\s*/>', 'g');

    while ((m = reSelf.exec(xml)) !== null) {
      const attrs = parseIndiAttrs(m[1]);
      results.push({ ...attrs, value: attrs.value || '' });
    }
  }

  return results;
}

module.exports = {
  processIndiBuffer,
  xAttr,
  xChildren,
};