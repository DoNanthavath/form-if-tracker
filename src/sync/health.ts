import { db } from '../db/db';
import type { ActivityEntry, WeightEntry } from '../lib/types';

/** One day of Apple Health values relayed by the iPhone Shortcut through the user's Sheet. */
export interface HealthRow {
  date: string;
  steps: number | null;
  exerciseMin: number | null;
  weightKg: number | null;
}

export const HEALTH_NOTE = 'Apple Health';

const num = (v: unknown, min: number, max: number): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export function normalizeHealthRows(raw: unknown): HealthRow[] {
  if (!Array.isArray(raw)) return [];
  const out = new Map<string, HealthRow>();
  for (const r of raw as Record<string, unknown>[]) {
    const date = String(r?.date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.set(date, {
      date,
      steps: num(r.steps, 0, 200000),
      exerciseMin: num(r.exerciseMin, 0, 1440),
      weightKg: num(r.weightKg, 20, 400),
    });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Upsert Health rows into FORM. Steps + exercise minutes become one "steps" activity
 * per day (id hk-<date>). Weight is only written on days without a manual weigh-in.
 * Unchanged records are not rewritten (so they don't trigger another sync).
 */
export async function applyHealthRows(rows: HealthRow[], now = Date.now()): Promise<{ activities: number; weights: number }> {
  let activities = 0;
  let weights = 0;
  await db.transaction('rw', db.activities, db.weights, async () => {
    for (const r of rows) {
      if (r.steps != null || r.exerciseMin != null) {
        const id = `hk-${r.date}`;
        const prev = await db.activities.get(id);
        const steps = r.steps != null ? Math.round(r.steps) : prev?.steps ?? null;
        const minutes = r.exerciseMin != null ? Math.round(r.exerciseMin) : prev?.minutes ?? null;
        if (!prev || prev.steps !== steps || prev.minutes !== minutes) {
          const a: ActivityEntry = { id, date: r.date, at: prev?.at ?? now, type: 'steps', minutes, steps, kcal: null, note: HEALTH_NOTE, createdAt: prev?.createdAt ?? now, updatedAt: now };
          await db.activities.put(a);
          activities++;
        }
      }
      if (r.weightKg != null) {
        const existing = await db.weights.where('date').equals(r.date).first();
        const kg = Math.round(r.weightKg * 10) / 10;
        if (!existing) {
          const w: WeightEntry = { id: `hk-w-${r.date}`, date: r.date, kg, waistCm: null, note: HEALTH_NOTE, createdAt: now, updatedAt: now };
          await db.weights.add(w);
          weights++;
        } else if (existing.note === HEALTH_NOTE && existing.kg !== kg) {
          await db.weights.put({ ...existing, kg, updatedAt: now });
          weights++;
        }
      }
    }
  });
  return { activities, weights };
}
