import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/db/db', async () => {
  const mod = await vi.importActual<typeof import('../src/db/db')>('../src/db/db');
  return { ...mod, db: new mod.FormDB('health-test') };
});

const { db } = await import('../src/db/db');
const { applyHealthRows, normalizeHealthRows, HEALTH_NOTE } = await import('../src/sync/health');

describe('Apple Health rows → FORM', () => {
  it('normalizes and validates', () => {
    expect(normalizeHealthRows([{ date: '2026-11-20', steps: 8001, exerciseMin: '', weightKg: 5 }, { date: 'bad' }, null])).toEqual([
      { date: '2026-11-20', steps: 8001, exerciseMin: null, weightKg: null },
    ]);
    expect(normalizeHealthRows('nope')).toEqual([]);
  });

  it('upserts one steps activity per day and never overwrites a manual weigh-in', async () => {
    await db.weights.add({ id: 'manual', date: '2026-11-19', kg: 84.6, waistCm: null, note: '', createdAt: 0, updatedAt: 0 });
    const rows = normalizeHealthRows([
      { date: '2026-11-19', steps: 6000, exerciseMin: 20, weightKg: 84.0 },
      { date: '2026-11-20', steps: 5234, exerciseMin: 32, weightKg: 84.2 },
    ]);
    expect(await applyHealthRows(rows, 1)).toEqual({ activities: 2, weights: 1 });
    expect(await db.activities.get('hk-2026-11-20')).toMatchObject({ type: 'steps', steps: 5234, minutes: 32, note: HEALTH_NOTE });
    expect((await db.weights.where('date').equals('2026-11-19').first())?.kg).toBe(84.6); // manual kept
    expect((await db.weights.where('date').equals('2026-11-20').first())?.note).toBe(HEALTH_NOTE);
    // idempotent: nothing rewritten when unchanged
    expect(await applyHealthRows(rows, 2)).toEqual({ activities: 0, weights: 0 });
    // later in the day: more steps, Health weight updated
    expect(await applyHealthRows(normalizeHealthRows([{ date: '2026-11-20', steps: 9000, exerciseMin: null, weightKg: 84.1 }]), 3)).toEqual({ activities: 1, weights: 1 });
    expect(await db.activities.get('hk-2026-11-20')).toMatchObject({ steps: 9000, minutes: 32 });
  });
});
