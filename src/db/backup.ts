import { z } from 'zod';
import type { FormDB } from './db';
import { SETTINGS_KEY, readSettings } from './db';
import { defaultSettings } from './defaults';
import { builtinFoods } from './foods';
import type { Settings } from '../lib/types';
import { dateKey, DEFAULT_TZ } from '../lib/time';
import { uid } from '../lib/id';

export const BACKUP_FORMAT = 'form-if-tracker';
export const BACKUP_VERSION = 1;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const finite = z.number().finite();
const nonneg = finite.min(0);
const epoch = z.number().int().min(0);
const protocol = z.enum(['12:12', '14:10', '16:8', '18:6', '20:4']);
const macros = { kcal: nonneg.max(20000), protein: nonneg.max(2000), carbs: nonneg.max(3000), fat: nonneg.max(2000) };

export const SettingsSchema = z.object({
  lang: z.enum(['th', 'en']),
  theme: z.enum(['dark', 'light', 'system']),
  accent: z.enum(['burgundy', 'mint', 'navy']),
  timeZone: z.string().min(1).max(64),
  age: finite.min(1).max(120),
  sex: z.enum(['male', 'female', 'unset']),
  heightCm: finite.min(50).max(260),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  bodyFatPct: finite.min(2).max(70).nullable(),
  startWeightKg: finite.min(20).max(400),
  startDate: dateStr,
  goalWeightsKg: z.array(finite.min(20).max(400)).max(10),
  kcalBudget: finite.min(500).max(10000),
  proteinG: finite.min(0).max(500),
  carbsG: finite.min(0).max(1000).nullable(),
  fatG: finite.min(0).max(500).nullable(),
  bmrFormula: z.enum(['mifflin', 'harris', 'katch']),
  weeklyLossTargetKg: finite.min(0).max(2),
  protocol,
  eatingStart: hm,
  waterTargetMl: finite.min(0).max(10000),
  lastExportAt: epoch.nullable(),
  onboarded: z.boolean(),
}).partial();

const FastSchema = z.object({
  id: z.string().min(1),
  protocol,
  targetHours: finite.min(1).max(168),
  startAt: epoch,
  endAt: epoch.nullable(),
  pauses: z.array(z.object({ start: epoch, end: epoch.nullable() })),
  status: z.enum(['active', 'paused', 'ended']),
  edited: z.boolean(),
  note: z.string().max(2000).optional(),
  createdAt: epoch,
  updatedAt: epoch,
}).refine((f) => f.endAt == null || f.endAt >= f.startAt, 'endAt before startAt');

const FoodEntrySchema = z.object({
  id: z.string().min(1),
  date: dateStr,
  time: hm,
  at: epoch,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'drink']),
  name: z.string().min(1).max(200),
  foodItemId: z.string().nullable(),
  quantity: finite.min(0).max(100),
  unit: z.string().max(100),
  photo: z.string().startsWith('data:image/').max(2_000_000).nullable(),
  notes: z.string().max(2000),
  createdAt: epoch,
  updatedAt: epoch,
  ...macros,
});

const FoodItemSchema = z.object({
  id: z.string().min(1),
  nameTh: z.string().max(200),
  nameEn: z.string().max(200),
  servingTh: z.string().max(100),
  servingEn: z.string().max(100),
  category: z.enum(['meal', 'side', 'fruit', 'drink', 'snack', 'protein', 'custom']),
  builtin: z.boolean(),
  updatedAt: epoch,
  ...macros,
}).refine((f) => f.nameTh || f.nameEn, 'food item needs a name');

const SavedMealSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: finite.min(0).max(100),
    unit: z.string().max(100),
    foodItemId: z.string().nullable(),
    ...macros,
  })).max(50),
  createdAt: epoch,
  updatedAt: epoch,
});

const WeightSchema = z.object({
  id: z.string().min(1),
  date: dateStr,
  kg: finite.min(20).max(400),
  waistCm: finite.min(30).max(300).nullable(),
  note: z.string().max(2000),
  createdAt: epoch,
  updatedAt: epoch,
});

const WaterSchema = z.object({ id: z.string().min(1), date: dateStr, at: epoch, ml: finite.min(1).max(5000) });

const ActivitySchema = z.object({
  id: z.string().min(1),
  date: dateStr,
  at: epoch,
  type: z.enum(['walk', 'run', 'cycling', 'strength', 'yoga', 'sport', 'steps', 'other']),
  minutes: finite.min(0).max(1440).nullable(),
  steps: finite.min(0).max(200000).nullable(),
  kcal: finite.min(0).max(10000).nullable(),
  note: z.string().max(2000),
  createdAt: epoch,
  updatedAt: epoch,
});

export const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: epoch,
  data: z.object({
    settings: SettingsSchema,
    fasts: z.array(FastSchema),
    foods: z.array(FoodEntrySchema),
    foodItems: z.array(FoodItemSchema),
    meals: z.array(SavedMealSchema),
    weights: z.array(WeightSchema),
    water: z.array(WaterSchema),
    activities: z.array(ActivitySchema),
  }),
});

export type Backup = z.infer<typeof BackupSchema>;

export async function exportBackup(database: FormDB, now = Date.now()): Promise<Backup> {
  return database.transaction('r', [database.kv, database.fasts, database.foods, database.foodItems, database.meals, database.weights, database.water, database.activities], async () => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    data: {
      settings: await readSettings(database, defaultSettings(now)),
      fasts: await database.fasts.toArray(),
      foods: await database.foods.toArray(),
      foodItems: await database.foodItems.toArray(),
      meals: await database.meals.toArray(),
      weights: await database.weights.toArray(),
      water: await database.water.toArray(),
      activities: await database.activities.toArray(),
    },
  }));
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  const res = BackupSchema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    return { ok: false, error: `${issue.path.join('.') || 'root'}: ${issue.message}` };
  }
  // Duplicate weight dates would violate the unique index.
  const dates = res.data.data.weights.map((w) => w.date);
  if (new Set(dates).size !== dates.length) return { ok: false, error: 'data.weights: duplicate dates' };
  return { ok: true, backup: res.data };
}

export function backupCounts(b: Backup) {
  const d = b.data;
  return { fasts: d.fasts.length, foods: d.foods.length, weights: d.weights.length, water: d.water.length, activities: d.activities.length, meals: d.meals.length, foodItems: d.foodItems.length };
}

/**
 * Import a validated backup. 'replace' wipes everything first; 'merge' upserts by id
 * (records in the file win; weights are matched by date). Runs in one transaction,
 * so a failure leaves existing data untouched.
 */
export async function importBackup(database: FormDB, b: Backup, mode: 'replace' | 'merge'): Promise<void> {
  const tables = [database.kv, database.fasts, database.foods, database.foodItems, database.meals, database.weights, database.water, database.activities];
  await database.transaction('rw', tables, async () => {
    const d = b.data;
    if (mode === 'replace') {
      // Device-only secrets (AI key, Sheets sync link) are never in backups; keep them.
      const keep = (await database.kv.bulkGet(['ai', 'sync'])).filter((r): r is NonNullable<typeof r> => !!r);
      await Promise.all(tables.map((t) => t.clear()));
      await database.kv.bulkPut(keep);
      await database.kv.put({ key: SETTINGS_KEY, value: { ...defaultSettings(), ...d.settings, onboarded: true } });
    } else {
      const current = await readSettings(database, defaultSettings());
      await database.kv.put({ key: SETTINGS_KEY, value: { ...current, ...d.settings, onboarded: true } });
      const incomingDates = new Set(d.weights.map((w) => w.date));
      const clash = await database.weights.where('date').anyOf([...incomingDates]).toArray();
      await database.weights.bulkDelete(clash.map((w) => w.id));
    }
    await database.fasts.bulkPut(d.fasts);
    await database.foods.bulkPut(d.foods);
    await database.foodItems.bulkPut(d.foodItems);
    await database.meals.bulkPut(d.meals);
    await database.weights.bulkPut(d.weights);
    await database.water.bulkPut(d.water);
    await database.activities.bulkPut(d.activities);
  });
}

export async function wipeAll(database: FormDB): Promise<void> {
  const tables = [database.kv, database.fasts, database.foods, database.foodItems, database.meals, database.weights, database.water, database.activities];
  await database.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await database.foodItems.bulkPut(builtinFoods());
  });
}

/* ───────────────────────── First-run & legacy migration ───────────────────────── */

const LEGACY_KEY = 'form-if-v1';

interface LegacyData {
  settings?: { start?: string; end?: string; cal?: number; protein?: number; startWeight?: number; goal?: number };
  food?: { id?: string; date?: string; name?: string; cal?: number; protein?: number }[];
  weights?: { id?: string; date?: string; kg?: number }[];
}

/** Convert the original single-file app's localStorage data into new records. */
export function convertLegacy(raw: string, now = Date.now()) {
  const v = JSON.parse(raw) as LegacyData;
  const settings: Partial<Settings> = {};
  const s = v.settings ?? {};
  if (typeof s.cal === 'number' && s.cal >= 500) settings.kcalBudget = s.cal;
  if (typeof s.protein === 'number' && s.protein >= 0) settings.proteinG = s.protein;
  if (typeof s.startWeight === 'number' && s.startWeight >= 20) settings.startWeightKg = s.startWeight;
  if (typeof s.start === 'string' && /^\d{2}:\d{2}$/.test(s.start)) settings.eatingStart = s.start;
  const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const foods = (v.food ?? [])
    .filter((f) => isDate(f.date) && typeof f.name === 'string' && f.name.trim() && Number.isFinite(f.cal))
    .map((f) => ({
      id: f.id || uid(), date: f.date!, time: '12:00', at: now, mealType: 'lunch' as const,
      name: f.name!.trim().slice(0, 200), foodItemId: null, quantity: 1, unit: '',
      kcal: Math.max(0, Number(f.cal)), protein: Math.max(0, Number(f.protein) || 0), carbs: 0, fat: 0,
      photo: null, notes: '', createdAt: now, updatedAt: now,
    }));
  const seen = new Set<string>();
  const weights = (v.weights ?? [])
    .filter((w) => isDate(w.date) && Number(w.kg) >= 20 && Number(w.kg) <= 400)
    .filter((w) => (seen.has(w.date!) ? false : (seen.add(w.date!), true)))
    .map((w) => ({ id: w.id || uid(), date: w.date!, kg: Number(w.kg), waistCm: null, note: '', createdAt: now, updatedAt: now }));
  return { settings, foods, weights };
}

/** Seed built-in foods on first run and pull in legacy localStorage data once. */
export async function initDatabase(database: FormDB, storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null) {
  const now = Date.now();
  await database.transaction('rw', [database.kv, database.foodItems, database.foods, database.weights], async () => {
    const seeded = await database.kv.get('seeded');
    if (!seeded) {
      const existing = new Set((await database.foodItems.toArray()).map((f) => f.id));
      await database.foodItems.bulkPut(builtinFoods(now).filter((f) => !existing.has(f.id)));
      await database.kv.put({ key: 'seeded', value: now });
    }
    const migrated = await database.kv.get('legacyMigrated');
    const raw = storage?.getItem(LEGACY_KEY);
    if (!migrated && raw) {
      try {
        const legacy = convertLegacy(raw, now);
        const current = await readSettings(database, defaultSettings(now));
        await database.kv.put({ key: SETTINGS_KEY, value: { ...current, ...legacy.settings } });
        await database.foods.bulkPut(legacy.foods);
        const existingDates = new Set((await database.weights.toArray()).map((w) => w.date));
        await database.weights.bulkPut(legacy.weights.filter((w) => !existingDates.has(w.date)));
      } catch (e) {
        console.warn('Legacy migration skipped', e);
      }
      await database.kv.put({ key: 'legacyMigrated', value: now });
    }
  });
}

export function backupFileName(now = Date.now(), tz = DEFAULT_TZ) {
  return `form-backup-${dateKey(now, tz)}.json`;
}
