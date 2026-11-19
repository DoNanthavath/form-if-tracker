/**
 * Google Apps Script (standalone project) that receives FORM's data. It is the same
 * for everyone, so it can be copied as-is:
 *  - the first request it receives "claims" it with that phone's random token
 *    (stored in Script Properties); every later request must carry the same token;
 *  - on first sync it creates a private spreadsheet in the owner's Drive and returns its URL.
 */
export const APPS_SCRIPT_VERSION = 3;

export const APPS_SCRIPT_SOURCE = `// FORM → Google Sheets sync (v${APPS_SCRIPT_VERSION})
// Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
// Updating: paste this code, Save, then Deploy → Manage deployments → ✏️ → Version: New version → Deploy.
// Your spreadsheet stays private. Only the phone that connects first is accepted.
// To connect a different phone: select resetToken above and press Run.

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'health') return out_(healthPush_(body));
    const props = PropertiesService.getScriptProperties();
    const token = String(body.token || '');
    if (token.length < 32) return out_({ ok: false, error: 'bad-token' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const saved = props.getProperty('TOKEN');
      if (!saved) props.setProperty('TOKEN', token);
      else if (saved !== token) return out_({ ok: false, error: 'unauthorized' });
      if (body.healthKey && String(body.healthKey).length >= 24) props.setProperty('HEALTH_KEY', String(body.healthKey));
      if (body.tz) props.setProperty('TZ', String(body.tz));

      const ss = sheet_(props);
      if (body.action === 'health_pull') return out_({ ok: true, version: ${APPS_SCRIPT_VERSION}, rows: healthRows_(ss) });

      Object.keys(body.tables).forEach(function (name) {
        const t = body.tables[name];
        const sh = ss.getSheetByName(name) || ss.insertSheet(name);
        sh.clearContents();
        const values = [t.headers].concat(t.rows);
        sh.getRange(1, 1, values.length, t.headers.length).setValues(values);
        sh.setFrozenRows(1);
      });
      const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
      if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
      return out_({ ok: true, version: ${APPS_SCRIPT_VERSION}, sheetUrl: ss.getUrl(), syncedAt: new Date().toISOString() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// Apple Health values sent by the iPhone Shortcut (GET or POST with action=health).
function healthPush_(p) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('HEALTH_KEY');
  if (!key || String(p.key || '') !== key) return { ok: false, error: 'bad-health-key' };
  const tz = props.getProperty('TZ') || 'Asia/Vientiane';
  const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(p.date || '')) ? String(p.date) : Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const num = function (v) { const s = String(v == null ? '' : v).replace(/,/g, '').replace(/[^0-9.]/g, ''); const n = Number(s); return s !== '' && isFinite(n) ? n : ''; };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = sheet_(props);
    const sh = healthSheet_(ss);
    const values = sh.getDataRange().getValues();
    let row = -1;
    for (let i = 1; i < values.length; i++) if (String(values[i][0]) === date) row = i + 1;
    const prev = row > 0 ? values[row - 1] : ['', '', '', ''];
    const steps = num(p.steps), ex = num(p.ex), kg = num(p.kg);
    const next = [date, steps === '' ? prev[1] : Math.round(steps), ex === '' ? prev[2] : Math.round(ex), kg === '' ? prev[3] : Math.round(kg * 10) / 10, new Date().toISOString()];
    if (row > 0) sh.getRange(row, 1, 1, 5).setValues([next]);
    else sh.appendRow(next);
    return { ok: true, date: date, steps: next[1], exerciseMin: next[2], weightKg: next[3] };
  } finally {
    lock.releaseLock();
  }
}

function healthSheet_(ss) {
  let sh = ss.getSheetByName('Health');
  if (!sh) {
    sh = ss.insertSheet('Health');
    sh.getRange('A:A').setNumberFormat('@');
    sh.appendRow(['date', 'steps', 'exercise_min', 'weight_kg', 'updated']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function healthRows_(ss) {
  const sh = ss.getSheetByName('Health');
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1).filter(function (r) { return r[0]; }).map(function (r) {
    return { date: String(r[0]), steps: r[1], exerciseMin: r[2], weightKg: r[3] };
  });
}

function sheet_(props) {
  const id = props.getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted: create a new one */ }
  }
  const ss = SpreadsheetApp.create('FORM – IF & Wellness data');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function resetToken() {
  PropertiesService.getScriptProperties().deleteProperty('TOKEN');
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'health') return out_(healthPush_(p));
  return out_({ ok: true, app: 'FORM sync', version: ${APPS_SCRIPT_VERSION} });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;

export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const SETUP_PATH = '#/sheets';
