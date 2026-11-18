import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { FormDB, readSettings, writeSettings } from '../src/db/db';
import { backupCounts, convertLegacy, exportBackup, importBackup, initDatabase, parseBackup, wipeAll } from '../src/db/backup';
import { defaultSettings } from '../src/db/defaults';

let n = 0;
let db: FormDB;
beforeEach(async () => {
  db = new FormDB(`test-${n++}`);
  await initDatabase(db, null);
});

const now = Date.UTC(2026, 2, 10, 5);
const weight = (date: string, kg: number) => ({ id: `w-${date}`, date, kg, waistCm: null, note: '', createdAt: now, updatedAt: now });

describe('backup export/import', () => {
  it('round-trips all tables', async () => {
    await writeSettings(db, { kcalBudget: 1800, lang: 'en' }, defaultSettings());
    await db.weights.add(weight('2026-03-10', 84.2));
    await db.fasts.add({ id: 'f1', protocol: '18:6', targetHours: 18, startAt: now - 18 * 3.6e6, endAt: now, pauses: [], status: 'ended', edited: false, createdAt: now, updatedAt: now });
    await db.water.add({ id: 'h1', date: '2026-03-10', at: now, ml: 500 });
    const json = JSON.stringify(await exportBackup(db, now));

    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(backupCounts(parsed.backup)).toMatchObject({ weights: 1, fasts: 1, water: 1, foodItems: 20 });

    const other = new FormDB(`test-${n++}`);
    await importBackup(other, parsed.backup, 'replace');
    expect((await readSettings(other, defaultSettings())).kcalBudget).toBe(1800);
    expect(await other.weights.count()).toBe(1);
    expect(await other.fasts.get('f1')).toMatchObject({ endAt: now });
  });

  it('rejects malformed or foreign files', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parseBackup('{"format":"other"}').ok).toBe(false);
    const bad = { format: 'form-if-tracker', version: 1, exportedAt: now, data: { settings: {}, fasts: [], foods: [], foodItems: [], meals: [], weights: [{ ...weight('2026-03-10', 5) }], water: [], activities: [] } };
    const r = parseBackup(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('data.weights.0.kg');
  });

  it('rejects future versions and duplicate weight dates', () => {
    const base = { format: 'form-if-tracker', exportedAt: now, data: { settings: {}, fasts: [], foods: [], foodItems: [], meals: [], weights: [], water: [], activities: [] } };
    expect(parseBackup(JSON.stringify({ ...base, version: 99 })).ok).toBe(false);
    const dup = { ...base, version: 1, data: { ...base.data, weights: [weight('2026-03-10', 84), { ...weight('2026-03-10', 83), id: 'x' }] } };
    expect(parseBackup(JSON.stringify(dup)).ok).toBe(false);
  });

  it('merge keeps existing data and replaces same-day weights', async () => {
    await db.weights.add(weight('2026-03-09', 84.6));
    await db.weights.add({ ...weight('2026-03-10', 84.4), id: 'local' });
    const file = { format: 'form-if-tracker', version: 1, exportedAt: now, data: { settings: {}, fasts: [], foods: [], foodItems: [], meals: [], weights: [weight('2026-03-10', 84.1)], water: [], activities: [] } };
    const parsed = parseBackup(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);
    await importBackup(db, parsed.backup, 'merge');
    const all = await db.weights.orderBy('date').toArray();
    expect(all.map((x) => x.kg)).toEqual([84.6, 84.1]);
  });

  it('a failed import leaves data untouched', async () => {
    await db.weights.add(weight('2026-03-09', 84.6));
    const parsed = parseBackup(JSON.stringify({ format: 'form-if-tracker', version: 1, exportedAt: now, data: { settings: {}, fasts: [], foods: [], foodItems: [], meals: [], weights: [], water: [], activities: [] } }));
    if (!parsed.ok) throw new Error(parsed.error);
    // Sabotage: a record that violates the primary key type mid-transaction
    (parsed.backup.data.water as unknown[]).push({ id: undefined, date: '2026-03-09', at: 0, ml: 1 });
    await expect(importBackup(db, parsed.backup, 'replace')).rejects.toBeTruthy();
    expect(await db.weights.count()).toBe(1);
  });

  it('wipe resets to built-in foods only', async () => {
    await db.weights.add(weight('2026-03-09', 84.6));
    await wipeAll(db);
    expect(await db.weights.count()).toBe(0);
    expect(await db.foodItems.count()).toBe(20);
  });
});

describe('legacy migration', () => {
  it('converts the original localStorage format', () => {
    const raw = JSON.stringify({
      settings: { start: '12:00', end: '18:00', cal: 1850, protein: 125, startWeight: 85, goal: 80 },
      food: [{ id: 'a', date: '2026-03-01', name: 'ข้าวเหนียว', cal: 200, protein: 4 }, { date: 'bad', name: 'x', cal: 1 }],
      weights: [{ id: 'w', date: '2026-03-01', kg: 84.8 }, { date: '2026-03-01', kg: 84.9 }],
    });
    const out = convertLegacy(raw, now);
    expect(out.settings).toMatchObject({ kcalBudget: 1850, proteinG: 125, eatingStart: '12:00' });
    expect(out.foods).toHaveLength(1);
    expect(out.weights).toHaveLength(1);
  });

  it('runs once from storage on init', async () => {
    const store = new Map<string, string>([['form-if-v1', JSON.stringify({ settings: { cal: 2000 }, food: [], weights: [{ date: '2026-03-01', kg: 84 }] })]]);
    const storage = { getItem: (k: string) => store.get(k) ?? null } as unknown as Storage;
    const fresh = new FormDB(`test-${n++}`);
    await initDatabase(fresh, storage);
    await initDatabase(fresh, storage);
    expect(await fresh.weights.count()).toBe(1);
    expect((await readSettings(fresh, defaultSettings())).kcalBudget).toBe(2000);
  });
});
