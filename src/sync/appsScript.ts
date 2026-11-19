/**
 * Google Apps Script (standalone project) that receives FORM's data. It is the same
 * for everyone, so it can be copied as-is:
 *  - the first request it receives "claims" it with that phone's random token
 *    (stored in Script Properties); every later request must carry the same token;
 *  - on first sync it creates a private spreadsheet in the owner's Drive and returns its URL.
 */
export const APPS_SCRIPT_VERSION = 2;

export const APPS_SCRIPT_SOURCE = `// FORM → Google Sheets sync (v${APPS_SCRIPT_VERSION})
// Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
// Your spreadsheet stays private. Only the phone that connects first is accepted.
// To connect a different phone: select resetToken above and press Run.

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const token = String(body.token || '');
    if (token.length < 32) return out_({ ok: false, error: 'bad-token' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const saved = props.getProperty('TOKEN');
      if (!saved) props.setProperty('TOKEN', token);
      else if (saved !== token) return out_({ ok: false, error: 'unauthorized' });

      const ss = sheet_(props);
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
      return out_({ ok: true, sheetUrl: ss.getUrl(), syncedAt: new Date().toISOString() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
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

function doGet() {
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
