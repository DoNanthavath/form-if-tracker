import { describe, expect, it } from 'vitest';
import { buildPayload, safeText } from '../src/sync/payload';
import { appsScriptSource, newToken } from '../src/sync/appsScript';
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
  // Minimal mock of the Apps Script runtime
  function run(token: string, body: unknown) {
    const sheets: Record<string, unknown[][]> = {};
    const mk = (name: string) => ({
      clearContents: () => { sheets[name] = []; },
      getRange: (_r: number, _c: number, rows: number, cols: number) => ({ setValues: (v: unknown[][]) => { expect(v.length).toBe(rows); v.forEach((row) => expect(row.length).toBe(cols)); sheets[name] = v; } }),
      setFrozenRows: () => {},
    });
    const env = {
      SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null, insertSheet: mk }) },
      LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s: string) => ({ setMimeType: () => JSON.parse(s) }) },
    };
    const fn = new Function(...Object.keys(env), `${appsScriptSource(token)}; return doPost;`)(...Object.values(env));
    return { result: fn({ postData: { contents: JSON.stringify(body) } }), sheets };
  }
  it('rejects a wrong token and writes nothing', () => {
    const r = run('secret', buildPayload('nope', TZ, data));
    expect(r.result).toEqual({ ok: false, error: 'unauthorized' });
    expect(Object.keys(r.sheets)).toHaveLength(0);
  });
  it('writes every table with the right token', () => {
    const r = run('secret', buildPayload('secret', TZ, data));
    expect(r.result.ok).toBe(true);
    expect(Object.keys(r.sheets).sort()).toEqual(['Activity', 'Daily', 'Fasting', 'Food', 'Water', 'Weight']);
    expect(r.sheets.Weight[1]).toEqual(['w', '2026-03-10', 84.6, '', '']);
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
