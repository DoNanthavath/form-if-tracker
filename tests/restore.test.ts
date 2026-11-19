import { describe, expect, it } from 'vitest';
import writeXlsxFile from 'write-excel-file/node';
import readXlsxFile from 'read-excel-file/node';
import { buildPayload } from '../src/sync/payload';
import { backupFromSheet, cellDate, cellTime, recordsFromSheet, type Tables } from '../src/sync/restore';
import { HOUR, zonedInstant } from '../src/lib/time';
import { fastedMs, isVerifiedComplete } from '../src/lib/fasting';

const TZ = 'Asia/Vientiane';
const at = (d: string, t: string) => zonedInstant(d, t, TZ);
const start = at('2026-11-18', '18:00');
const data = {
  fasts: [
    { id: 'f1', protocol: '18:6' as const, targetHours: 18, startAt: start, endAt: at('2026-11-19', '12:00'), pauses: [], status: 'ended' as const, edited: true, createdAt: 0, updatedAt: 0 },
    { id: 'f2', protocol: '18:6' as const, targetHours: 18, startAt: at('2026-11-19', '18:00'), endAt: null, pauses: [], status: 'active' as const, edited: false, createdAt: 0, updatedAt: 0 },
  ],
  foods: [
    { id: 'a', date: '2026-11-19', time: '12:40', at: at('2026-11-19', '12:40'), mealType: 'lunch' as const, name: '=bad', foodItemId: null, quantity: 0.5, unit: '1 ชาม', kcal: 225, protein: 14, carbs: 27.5, fat: 6, photo: 'data:image/jpeg;base64,x', notes: 'ChatGPT (มั่นใจปานกลาง)', createdAt: 0, updatedAt: 0 },
    { id: 'b', date: '2026-11-19', time: '17:05', at: at('2026-11-19', '17:05'), mealType: 'dinner' as const, name: 'ข้าวเหนียว', foodItemId: 'f-sticky-rice', quantity: 1, unit: '', kcal: 200, protein: 4, carbs: 44, fat: 0.5, photo: null, notes: '', createdAt: 0, updatedAt: 0 },
  ],
  weights: [{ id: 'w', date: '2026-11-19', kg: 84.6, waistCm: 96, note: '', createdAt: 0, updatedAt: 0 }],
  water: [{ id: 'h', date: '2026-11-19', at: at('2026-11-19', '09:15'), ml: 500 }],
  activities: [{ id: 'x', date: '2026-11-19', at: 0, type: 'walk' as const, minutes: 30, steps: 4000, kcal: null, note: '', createdAt: 0, updatedAt: 0 }],
};

/** Emulate Google Sheets: it stores "2026-11-19", "12:40", "2026-11-18 18:00" as date/time cells. */
function googleify(v: unknown) {
  if (typeof v !== 'string') return v;
  let m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(v);
  if (m) return { value: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])), format: 'yyyy-mm-dd hh:mm' };
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return { value: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), format: 'yyyy-mm-dd' };
  m = /^(\d{2}):(\d{2})$/.exec(v);
  if (m) return { value: new Date(Date.UTC(1899, 11, 30, +m[1], +m[2])), format: 'hh:mm' };
  if (v.startsWith("'")) return v.slice(1); // Sheets hides the text marker
  return v;
}

async function exportLikeGoogle(): Promise<Tables> {
  const payload = buildPayload('t'.repeat(48), TZ, data);
  const sheets = Object.entries(payload.tables).map(([name, t]) => ({
    sheet: name,
    data: [t.headers.map((h) => ({ value: h })), ...t.rows.map((r) => r.map((c) => (c === '' ? null : typeof googleify(c) === 'object' ? googleify(c) : { value: googleify(c) })))],
  }));
  const buf = await writeXlsxFile(sheets as never).toBuffer();
  const read = await readXlsxFile(buf);
  return Object.fromEntries(read.map((s) => [s.sheet, s.data])) as Tables;
}

describe('restore from Google Sheet (.xlsx)', () => {
  it('parses date and time cells', () => {
    expect(cellDate(new Date(Date.UTC(2026, 10, 19)))).toBe('2026-11-19');
    expect(cellTime(new Date(Date.UTC(1899, 11, 30, 12, 40)))).toBe('12:40');
    expect(cellTime(0.5)).toBe('12:00');
    expect(cellDate('2026-11-19 18:00')).toBe('2026-11-19');
  });

  it('round-trips everything FORM synced', async () => {
    const tables = await exportLikeGoogle();
    const r = recordsFromSheet(tables, TZ, 1);
    expect(r.foods.map((f) => [f.id, f.date, f.time, f.at, f.mealType, f.name, f.quantity, f.kcal, f.protein, f.carbs, f.fat])).toEqual([
      ['a', '2026-11-19', '12:40', at('2026-11-19', '12:40'), 'lunch', '=bad', 0.5, 225, 14, 27.5, 6],
      ['b', '2026-11-19', '17:05', at('2026-11-19', '17:05'), 'dinner', 'ข้าวเหนียว', 1, 200, 4, 44, 0.5],
    ]);
    expect(r.weights).toMatchObject([{ id: 'w', date: '2026-11-19', kg: 84.6, waistCm: 96 }]);
    expect(r.water).toMatchObject([{ id: 'h', at: at('2026-11-19', '09:15'), ml: 500 }]);
    expect(r.activities).toMatchObject([{ id: 'x', type: 'walk', minutes: 30, steps: 4000 }]);
    const [f1, f2] = r.fasts;
    expect(f1).toMatchObject({ id: 'f1', startAt: start, endAt: at('2026-11-19', '12:00'), status: 'ended', edited: true });
    expect(isVerifiedComplete(f1)).toBe(true);
    expect(fastedMs(f1, f1.endAt!)).toBe(18 * HOUR);
    expect(f2).toMatchObject({ id: 'f2', endAt: null, status: 'active' });
  });

  it('produces a valid backup and rejects unrelated files', async () => {
    const ok = backupFromSheet(await exportLikeGoogle(), TZ);
    expect(ok.ok).toBe(true);
    expect(backupFromSheet({ Sheet1: [['hello'], ['world']] }, TZ)).toEqual({ ok: false, error: 'no FORM data found in this file' });
  });
});
