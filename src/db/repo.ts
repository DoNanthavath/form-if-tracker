import { db } from './db';
import type { ActivityEntry, FastSession, FoodEntry, FoodItem, ProtocolId, SavedMeal, WaterEntry, WeightEntry } from '../lib/types';
import { endSession, pauseSession, resumeSession, startSession } from '../lib/fasting';
import { uid } from '../lib/id';

/* Fasting */
export async function activeFast(): Promise<FastSession | undefined> {
  return db.fasts.where('status').anyOf('active', 'paused').first();
}

export async function startFast(protocol: ProtocolId, startAt: number) {
  return db.transaction('rw', db.fasts, async () => {
    if (await activeFast()) throw new Error('errActiveExists');
    const s = startSession(uid(), protocol, startAt, Date.now());
    await db.fasts.add(s);
    return s;
  });
}

async function mutateFast(id: string, fn: (s: FastSession) => FastSession) {
  await db.transaction('rw', db.fasts, async () => {
    const s = await db.fasts.get(id);
    if (s) await db.fasts.put(fn(s));
  });
}

export const pauseFast = (id: string) => mutateFast(id, (s) => pauseSession(s, Date.now()));
export const resumeFast = (id: string) => mutateFast(id, (s) => resumeSession(s, Date.now()));
export const endFast = (id: string, endAt = Date.now()) => mutateFast(id, (s) => endSession(s, endAt, Date.now()));

export async function saveFastTimes(id: string | null, protocol: ProtocolId, targetHours: number, startAt: number, endAt: number | null) {
  const now = Date.now();
  if (id) {
    await mutateFast(id, (s) => {
      // drop pauses that fall outside the new range
      const pauses = s.pauses
        .filter((p) => p.start >= startAt && (endAt == null || p.start < endAt))
        .map((p) => (endAt != null && (p.end == null || p.end > endAt) ? { ...p, end: endAt } : p));
      return { ...s, protocol, targetHours, startAt, endAt: endAt ?? s.endAt, pauses, edited: true, updatedAt: now };
    });
  } else {
    if (endAt == null) throw new Error('errInvalidTime');
    const s: FastSession = { id: uid(), protocol, targetHours, startAt, endAt, pauses: [], status: 'ended', edited: true, createdAt: now, updatedAt: now };
    await db.fasts.add(s);
  }
}

export const deleteFast = (id: string) => db.fasts.delete(id);

/* Food */
export async function saveFood(entry: FoodEntry) {
  await db.foods.put({ ...entry, updatedAt: Date.now() });
}
export async function deleteFood(id: string): Promise<FoodEntry | undefined> {
  const e = await db.foods.get(id);
  await db.foods.delete(id);
  return e;
}
export const restoreFood = (e: FoodEntry) => db.foods.put(e);

export async function saveFoodItem(item: FoodItem) {
  await db.foodItems.put({ ...item, updatedAt: Date.now() });
}
export const deleteFoodItem = (id: string) => db.foodItems.delete(id);

export async function saveMeal(meal: SavedMeal) {
  await db.meals.put({ ...meal, updatedAt: Date.now() });
}
export const deleteMeal = (id: string) => db.meals.delete(id);

/* Weight – one entry per local date */
export async function saveWeight(entry: Omit<WeightEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  const now = Date.now();
  await db.transaction('rw', db.weights, async () => {
    const existing = await db.weights.where('date').equals(entry.date).first();
    if (existing && existing.id !== entry.id) await db.weights.delete(existing.id);
    const prev = entry.id ? await db.weights.get(entry.id) : undefined;
    await db.weights.put({
      id: entry.id ?? existing?.id ?? uid(),
      date: entry.date,
      kg: entry.kg,
      waistCm: entry.waistCm,
      note: entry.note,
      createdAt: prev?.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
    });
  });
}
export const deleteWeight = (id: string) => db.weights.delete(id);

/* Water & activity */
export async function addWater(date: string, ml: number): Promise<WaterEntry> {
  const e = { id: uid(), date, at: Date.now(), ml };
  await db.water.add(e);
  return e;
}
export const deleteWater = (id: string) => db.water.delete(id);

export async function saveActivity(a: ActivityEntry) {
  await db.activities.put({ ...a, updatedAt: Date.now() });
}
export const deleteActivity = (id: string) => db.activities.delete(id);
