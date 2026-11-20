import { describe, expect, it } from 'vitest';
import { buildPayload, safeText } from '../src/sync/payload';
import { APPS_SCRIPT_SOURCE, newToken } from '../src/sync/appsScript';
import { cleanAnalysis } from '../src/lib/ai';
import { zonedInstant, HOUR } from '../src/lib/time';

const TZ = 'Asia/Vientiane';
const start = zonedInstant('2026-03-09', '18:00', TZ);
const data = {
  fasts: [{ id: 'f', protocol: '18:6' as const, targetHours: 18, startAt: start, endAt: start + 18 * HOUR, pauses: [], status: 'ended' as const, edited: false, createdAt: 0, updatedAt: 0 }],
  foods: [{ id: 'a', date: '2026-03-10', time: '12:30', at: 0, mealType: 'lunch' as const, name: '=HYPERLINK("x")', foodItemId: null, quantity: 0.5, unit: '1 bowl', kcal: 225, protein: 14, carbs: 27.5, fat: 6, photo: 'data:image/jpeg;base64,xx', notes: '', createdAt: 0, updatedAt: 0 }],
  weights: [{ id: 'w', date: '2026-03-10', kg: 84.6, waistCm: null, note: '', createdAt: 0, updatedAt: 0 }],
  water: [{ id: 'h', date: '2026-03-10', at: zonedInstant('2026-03-10', '09:00', TZ), ml: 500 }],
  activities: [],
};

describe('sheets payload', () => {
  const p = buildPayload('tok', TZ, data);
  it('neutralises formula injection', () => {
    expect(safeText('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(safeText('-1+2')).toBe("'-1+2");
    expect(safeText('ข้าวเหนียว')).toBe('ข้าวเหนียว');
    expect(p.tables.Food.rows[0][4]).toBe('\'=HYPERLINK("x")');
  });
  it('never includes photo data', () => {
    expect(JSON.stringify(p)).not.toContain('base64');
    expect(p.tables.Food.rows[0][11]).toBe('yes');
  });
  it('builds a daily summary with local times', () => {
    const daily = p.tables.Daily.rows.find((r) => r[0] === '2026-03-10')!;
    expect(daily).toEqual(['2026-03-10', 225, 14, 27.5, 6, 500, 84.6, 18, 'yes', 0, 0]);
    expect(p.tables.Fasting.rows[0][3]).toBe('2026-03-09 18:00');
    expect(p.tables.Water.rows[0][2]).toBe('09:00');
    for (const t of Object.values(p.tables)) for (const r of t.rows) expect(r).toHaveLength(t.headers.length);
  });
});

describe('apps script', () => {
  // Mock of the Apps Script runtime (Script Properties persist across calls).
  function runtime() {
    const props = new Map<string, string>();
    const sheets: Record<string, unknown[][]> = {};
    let created = 0;
    function mk(name: string) {
      const rows = () => (sheets[name] ??= []);
      return {
        clearContents: () => { sheets[name] = []; },
        getRange: (r: number | string, _c?: number, nr?: number, nc?: number) => ({
          setValues: (v: unknown[][]) => {
            expect(v.length).toBe(nr);
            v.forEach((row, i) => { expect(row.length).toBe(nc); rows()[(r as number) - 1 + i] = row; });
          },
          setNumberFormat: () => {},
        }),
        getDataRange: () => ({ getValues: () => rows().map((r) => [...r]) }),
        appendRow: (row: unknown[]) => { rows().push(row); },
        setFrozenRows: () => {},
      };
    }
    const ss = {
      getSheetByName: (n: string) => (n in sheets ? mk(n) : null),
      insertSheet: (n: string) => { sheets[n] = []; return mk(n); },
      getSheets: () => Object.keys(sheets),
      deleteSheet: () => {},
      getUrl: () => 'https://docs.google.com/spreadsheets/d/abc/edit',
      getId: () => 'abc',
    };
    const env = {
      PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => props.get(k) ?? null, setProperty: (k: string, v: string) => void props.set(k, v), deleteProperty: (k: string) => void props.delete(k) }) },
      SpreadsheetApp: { create: () => { created++; return ss; }, openById: (id: string) => { if (id !== 'abc') throw new Error('gone'); return ss; } },
      LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s: string) => ({ setMimeType: () => JSON.parse(s) }) },
      Utilities: { formatDate: () => '2026-11-20' },
    };
    const api = new Function(...Object.keys(env), `${APPS_SCRIPT_SOURCE}; return { doPost, doGet, resetToken };`)(...Object.values(env));
    const post = (body: unknown) => api.doPost({ postData: { contents: JSON.stringify(body) } });
    const get = (parameter: Record<string, string>) => api.doGet({ parameter });
    return { post, get, reset: api.resetToken, sheets, props, created: () => created };
  }
  const A = 'a'.repeat(48);
  const B = 'b'.repeat(48);

  it('first phone claims the script; others are rejected until reset', () => {
    const rt = runtime();
    const first = rt.post(buildPayload(A, TZ, data));
    expect(first).toMatchObject({ ok: true, sheetUrl: 'https://docs.google.com/spreadsheets/d/abc/edit' });
    expect(rt.post(buildPayload(B, TZ, data))).toEqual({ ok: false, error: 'unauthorized' });
    expect(rt.post(buildPayload(A, TZ, data)).ok).toBe(true);
    rt.reset();
    expect(rt.post(buildPayload(B, TZ, data)).ok).toBe(true);
    expect(rt.post(buildPayload(A, TZ, data))).toEqual({ ok: false, error: 'unauthorized' });
  });
  it('creates the spreadsheet once and writes every table', () => {
    const rt = runtime();
    rt.post(buildPayload(A, TZ, data));
    rt.post(buildPayload(A, TZ, data));
    expect(rt.created()).toBe(1);
    expect(Object.keys(rt.sheets).sort()).toEqual(['Activity', 'Daily', 'Fasting', 'Food', 'Water', 'Weight']);
    expect(rt.sheets.Weight[1]).toEqual(['w', '2026-03-10', 84.6, '', '']);
  });
  it('Health: shortcut pushes with the health key; FORM pulls with its token', () => {
    const rt = runtime();
    const HK = 'h'.repeat(32);
    expect(rt.get({ action: 'health', key: HK, steps: '100' })).toEqual({ ok: false, error: 'bad-health-key' });
    rt.post({ ...buildPayload(A, TZ, data), healthKey: HK, tz: TZ });
    expect(rt.props.get('HEALTH_KEY')).toBe(HK);
    // Shortcuts formats numbers with thousands separators and units
    expect(rt.get({ action: 'health', key: HK, steps: '5,234', ex: '32', kg: '84.2 kg' })).toMatchObject({ ok: true, date: '2026-11-20', steps: 5234, exerciseMin: 32, weightKg: 84.2 });
    // same day again: updates the row, keeps weight when not sent
    rt.get({ action: 'health', key: HK, steps: '8,001', ex: '', kg: '' });
    expect(rt.get({ action: 'health', key: 'wrong'.repeat(8), steps: '1' })).toEqual({ ok: false, error: 'bad-health-key' });
    const pulled = rt.post({ token: A, action: 'health_pull' });
    expect(pulled.ok).toBe(true);
    expect(pulled.version).toBe(3);
    expect(pulled.rows).toEqual([{ date: '2026-11-20', steps: 8001, exerciseMin: 32, weightKg: 84.2 }]);
    expect(rt.post({ token: B, action: 'health_pull' })).toEqual({ ok: false, error: 'unauthorized' });
    // A full sync doesn't wipe the Health tab
    rt.post({ ...buildPayload(A, TZ, data), healthKey: HK });
    expect(rt.sheets.Health.length).toBe(2);
  });

  it('Health: a pull alone registers the health key (no full sync needed)', () => {
    const rt = runtime();
    rt.post({ ...buildPayload(A, TZ, data) }); // claimed earlier, before v3 (no key)
    expect(rt.post({ token: A, action: 'health_pull', healthKey: 'k'.repeat(32), tz: TZ })).toMatchObject({ ok: true, rows: [] });
    expect(rt.get({ action: 'health', key: 'k'.repeat(32), steps: '10' }).ok).toBe(true);
  });

  it('rejects short tokens', () => {
    expect(runtime().post({ token: 'x', tables: {} })).toEqual({ ok: false, error: 'bad-token' });
  });
  it('tokens are long and random', () => {
    const a = newToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(newToken()).not.toBe(a);
  });
});

describe('AI result cleanup', () => {
  it('clamps implausible numbers and trims', () => {
    const r = cleanAnalysis({ is_food: true, note: '', items: [
      { name: '  Pho  ', portion: '1 bowl', kcal: 452.6, protein: -3, carbs: NaN, fat: 99999, confidence: 'high' },
      { name: ' ', portion: '', kcal: 1, protein: 1, carbs: 1, fat: 1, confidence: 'low' },
    ] });
    expect(r.items).toEqual([{ name: 'Pho', portion: '1 bowl', kcal: 453, protein: 0, carbs: 0, fat: 500, confidence: 'high' }]);
  });
});

import { chatGptPrompt, chatGptUrl, parseChatGptReply } from '../src/lib/chatgpt';
describe('ChatGPT reply parsing', () => {
  it('reads a fenced JSON reply with surrounding text and smart quotes', () => {
    const reply = 'นี่คือผลครับ:\n```json\n{“items”:[{“name”:“ข้าวเหนียว”,“portion”:“1 กระติบเล็ก”,“kcal”:“250 kcal”,“protein”:5,“carbs”:55,“fat”:0.5,“confidence”:“high”}],“note”:“”}\n```\nหวังว่าจะช่วยได้';
    const r = parseChatGptReply(reply)!;
    expect(r.items).toEqual([{ name: 'ข้าวเหนียว', portion: '1 กระติบเล็ก', kcal: 250, protein: 5, carbs: 55, fat: 0.5, confidence: 'high' }]);
  });
  it('tolerates missing/odd fields and rejects garbage', () => {
    const r = parseChatGptReply('{"items":[{"name":"Pho","kcal":"450","protein":"28,5","confidence":"very"}]}')!;
    expect(r.items[0]).toMatchObject({ name: 'Pho', kcal: 450, protein: 28.5, carbs: 0, confidence: 'medium' });
    expect(parseChatGptReply('sorry, I cannot see the image')).toBeNull();
    expect(parseChatGptReply('{"items":[]}')).toBeNull();
  });
  it('builds a prompt in the user language and a prefilled link', () => {
    expect(chatGptPrompt('th', 'กินครึ่งเดียว')).toContain('in Thai');
    expect(chatGptPrompt('th', 'กินครึ่งเดียว')).toContain('กินครึ่งเดียว');
    expect(chatGptUrl('a b')).toBe('https://chatgpt.com/?q=a%20b');
  });
});
