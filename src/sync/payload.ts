import type { ActivityEntry, FastSession, FoodEntry, WaterEntry, WeightEntry } from '../lib/types';
import { dateKey, timeKey, HOUR } from '../lib/time';
import { fastedMs, isVerifiedComplete, sessionDate } from '../lib/fasting';
import { round1, sumMacros } from '../lib/nutrition';

type Cell = string | number | boolean;
export interface Table { headers: string[]; rows: Cell[][] }
export interface SheetPayload { token: string; tables: Record<string, Table> }

/** Prevent spreadsheet formula injection from free-text fields. */
export function safeText(v: string | null | undefined): string {
  const s = (v ?? '').replace(/\s+/g, ' ').trim();
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function buildPayload(token: string, tz: string, d: { fasts: FastSession[]; foods: FoodEntry[]; weights: WeightEntry[]; water: WaterEntry[]; activities: ActivityEntry[] }): SheetPayload {
  const local = (ms: number | null) => (ms == null ? '' : `${dateKey(ms, tz)} ${timeKey(ms, tz)}`);
  const byDate = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => a.date.localeCompare(b.date));
  const ended = d.fasts.filter((f) => f.endAt != null);

  const dates = new Set<string>([...d.foods, ...d.weights, ...d.water, ...d.activities].map((x) => x.date));
  ended.forEach((f) => dates.add(sessionDate(f, tz)!));
  const daily = [...dates].sort().map((date) => {
    const food = sumMacros(d.foods.filter((f) => f.date === date));
    const fasts = ended.filter((f) => sessionDate(f, tz) === date);
    return [
      date, food.kcal, food.protein, food.carbs, food.fat,
      d.water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0),
      d.weights.find((w) => w.date === date)?.kg ?? '',
      round1(fasts.reduce((a, f) => a + fastedMs(f, f.endAt!), 0) / HOUR),
      fasts.some(isVerifiedComplete) ? 'yes' : fasts.length ? 'no' : '',
      d.activities.filter((a) => a.date === date).reduce((a, x) => a + (x.minutes ?? 0), 0),
      d.activities.filter((a) => a.date === date).reduce((a, x) => a + (x.steps ?? 0), 0),
    ];
  });

  return {
    token,
    tables: {
      Daily: { headers: ['date', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'water_ml', 'weight_kg', 'fasted_h', 'fast_completed', 'active_min', 'steps'], rows: daily },
      Fasting: {
        headers: ['id', 'protocol', 'target_h', 'start', 'end', 'fasted_h', 'status', 'completed', 'edited'],
        rows: [...d.fasts].sort((a, b) => a.startAt - b.startAt).map((f) => [f.id, f.protocol, f.targetHours, local(f.startAt), local(f.endAt), f.endAt ? round1(fastedMs(f, f.endAt) / HOUR) : '', f.status, isVerifiedComplete(f) ? 'yes' : 'no', f.edited ? 'yes' : 'no']),
      },
      Food: {
        headers: ['id', 'date', 'time', 'meal', 'name', 'servings', 'unit', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'has_photo', 'notes'],
        rows: [...d.foods].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((f) => [f.id, f.date, f.time, f.mealType, safeText(f.name), f.quantity, safeText(f.unit), f.kcal, f.protein, f.carbs, f.fat, f.photo ? 'yes' : 'no', safeText(f.notes)]),
      },
      Weight: { headers: ['id', 'date', 'kg', 'waist_cm', 'note'], rows: byDate(d.weights).map((w) => [w.id, w.date, w.kg, w.waistCm ?? '', safeText(w.note)]) },
      Water: { headers: ['id', 'date', 'time', 'ml'], rows: [...d.water].sort((a, b) => a.at - b.at).map((w) => [w.id, w.date, timeKey(w.at, tz), w.ml]) },
      Activity: { headers: ['id', 'date', 'type', 'minutes', 'steps', 'kcal', 'note'], rows: byDate(d.activities).map((a) => [a.id, a.date, a.type, a.minutes ?? '', a.steps ?? '', a.kcal ?? '', safeText(a.note)]) },
    },
  };
}
