/**
 * Google Apps Script that receives FORM's data and mirrors it into the Sheet it is
 * attached to. The token is generated on the device and baked into the script,
 * so only this phone can write; the Sheet itself stays private to its owner.
 */
export const APPS_SCRIPT_VERSION = 1;

export function appsScriptSource(token: string): string {
  return `// FORM → Google Sheets sync (v${APPS_SCRIPT_VERSION})
// Paste into Extensions → Apps Script of your private Google Sheet, then
// Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
// Your Sheet stays private. Only requests carrying this secret token are accepted.
const TOKEN = '${token}';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return out_({ ok: false, error: 'unauthorized' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      Object.keys(body.tables).forEach(function (name) {
        const t = body.tables[name];
        const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
        sheet.clearContents();
        const values = [t.headers].concat(t.rows);
        sheet.getRange(1, 1, values.length, t.headers.length).setValues(values);
        sheet.setFrozenRows(1);
      });
    } finally {
      lock.releaseLock();
    }
    return out_({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out_({ ok: true, app: 'FORM sync', version: ${APPS_SCRIPT_VERSION} });
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;
}

export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
