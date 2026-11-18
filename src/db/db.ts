import Dexie, { type EntityTable } from 'dexie';
import type {
  ActivityEntry, FastSession, FoodEntry, FoodItem, SavedMeal, Settings, WaterEntry, WeightEntry,
} from '../lib/types';

export interface KV {
  key: string;
  value: unknown;
}

export class FormDB extends Dexie {
  kv!: EntityTable<KV, 'key'>;
  fasts!: EntityTable<FastSession, 'id'>;
  foods!: EntityTable<FoodEntry, 'id'>;
  foodItems!: EntityTable<FoodItem, 'id'>;
  meals!: EntityTable<SavedMeal, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  water!: EntityTable<WaterEntry, 'id'>;
  activities!: EntityTable<ActivityEntry, 'id'>;

  constructor(name = 'form-if-tracker') {
    super(name);
    this.version(1).stores({
      kv: 'key',
      fasts: 'id, startAt, endAt, status',
      foods: 'id, date, at, name, foodItemId',
      foodItems: 'id, nameTh, nameEn, updatedAt',
      meals: 'id, name',
      weights: 'id, &date',
      water: 'id, date, at',
      activities: 'id, date, at',
    });
  }
}

export const db = new FormDB();

export const SETTINGS_KEY = 'settings';

export async function readSettings(database: FormDB, fallback: Settings): Promise<Settings> {
  const row = await database.kv.get(SETTINGS_KEY);
  return { ...fallback, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function writeSettings(database: FormDB, patch: Partial<Settings>, fallback: Settings): Promise<Settings> {
  return database.transaction('rw', database.kv, async () => {
    const next = { ...(await readSettings(database, fallback)), ...patch };
    await database.kv.put({ key: SETTINGS_KEY, value: next });
    return next;
  });
}
