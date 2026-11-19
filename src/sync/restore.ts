import type { ActivityEntry, ActivityType, FastSession, FoodEntry, MealType, ProtocolId, WaterEntry, WeightEntry } from '../lib/types';
import { HOUR, zonedInstant } from '../lib/time';
import { PROTOCOLS } from '../lib/fasting';
import { uid } from '../lib/id';
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, type ParseResult } from '../db/backup';

/**
 * Rebuild FORM records from the tabs FORM itself wrote to Google Sheets
 * (Fasting / Food / Weight / Water / Activity), e.g. after the app's local
 * storage was lost. Google Sheets turns date/time strings into real date cells,
 * which an .xlsx reader returns as Date objects (UTC-based) or day fractions.
 */
type Cell = string | number | boolean | Date | null | undefined;
export type Tables = Record<string, Cell[][]>;

const pad = (n: number) => String(n).padStart(2, '0');

export function cellDate(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? `${m[1]}-${pad(+m[2])}-${pad(+m[3])}` : null;
}

export function cellTime(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const mins = Math.round(v * 1440) % 1440;
    return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  }
  const m = /(\d{1,2}):(\d{2})/.exec(String(v ?? ''));
  return m && +m[1] < 24 && +m[2] < 60 ? `${pad(+m[1])}:${m[2]}` : null;
}

function cellNum(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const cellStr = (v: Cell) => (v instanceof Date ? v.toISOString() : String(v ?? '')).trim();

/** Rows of a tab as objects keyed by the header row. */
function rows(tables: Tables, name: string): Record<string, Cell>[] {
  const t = tables[name];
  if (!t || t.length < 2) return [];
  const headers = t[0].map((h) => cellStr(h));
  return t.slice(1).filter((r) => r.some((c) => cellStr(c) !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'];
const ACTS: ActivityType[] = ['walk', 'run', 'cycling', 'strength', 'yoga', 'sport', 'steps', 'other'];

export function recordsFromSheet(tables: Tables, tz: string, now = Date.now()) {
  const foods: FoodEntry[] = [];
  for (const r of rows(tables, 'Food')) {
    const date = cellDate(r.date);
    const time = cellTime(r.time) ?? '12:00';
    const name = cellStr(r.name).replace(/^'/, '');
    if (!date || !name) continue;
    const meal = cellStr(r.meal) as MealType;
    foods.push({
      id: cellStr(r.id) || uid(), date, time, at: zonedInstant(date, time, tz), mealType: MEALS.includes(meal) ? meal : 'lunch',
      name: name.slice(0, 200), foodItemId: null, quantity: Math.max(0, cellNum(r.servings) ?? 1), unit: cellStr(r.unit).replace(/^'/, '').slice(0, 100),
      kcal: Math.max(0, Math.round(cellNum(r.kcal) ?? 0)), protein: Math.max(0, cellNum(r.protein_g) ?? 0), carbs: Math.max(0, cellNum(r.carbs_g) ?? 0), fat: Math.max(0, cellNum(r.fat_g) ?? 0),
      photo: null, notes: cellStr(r.notes).replace(/^'/, '').slice(0, 2000), createdAt: now, updatedAt: now,
    });
  }

  const weightByDate = new Map<string, WeightEntry>();
  for (const r of rows(tables, 'Weight')) {
    const date = cellDate(r.date);
    const kg = cellNum(r.kg);
    if (!date || kg == null || kg < 20 || kg > 400) continue;
    const waist = cellNum(r.waist_cm);
    weightByDate.set(date, { id: cellStr(r.id) || uid(), date, kg, waistCm: waist != null && waist >= 30 && waist <= 300 ? waist : null, note: cellStr(r.note).replace(/^'/, '').slice(0, 2000), createdAt: now, updatedAt: now });
  }

  const water: WaterEntry[] = [];
  for (const r of rows(tables, 'Water')) {
    const date = cellDate(r.date);
    const ml = cellNum(r.ml);
    if (!date || ml == null || ml <= 0 || ml > 5000) continue;
    water.push({ id: cellStr(r.id) || uid(), date, at: zonedInstant(date, cellTime(r.time) ?? '12:00', tz), ml });
  }

  const activities: ActivityEntry[] = [];
  for (const r of rows(tables, 'Activity')) {
    const date = cellDate(r.date);
    if (!date) continue;
    const type = cellStr(r.type) as ActivityType;
    const minutes = cellNum(r.minutes);
    const steps = cellNum(r.steps);
    const kcal = cellNum(r.kcal);
    activities.push({
      id: cellStr(r.id) || uid(), date, at: zonedInstant(date, '12:00', tz), type: ACTS.includes(type) ? type : 'other',
      minutes: minutes != null && minutes >= 0 && minutes <= 1440 ? minutes : null, steps: steps != null && steps >= 0 ? Math.round(steps) : null,
      kcal: kcal != null && kcal >= 0 ? kcal : null, note: cellStr(r.note).replace(/^'/, '').slice(0, 2000), createdAt: now, updatedAt: now,
    });
  }

  const fasts: FastSession[] = [];
  for (const r of rows(tables, 'Fasting')) {
    const sd = cellDate(r.start);
    const st = cellTime(r.start);
    if (!sd || !st) continue;
    const startAt = zonedInstant(sd, st, tz);
    const ed = cellDate(r.end);
    const et = cellTime(r.end);
    const endAt = ed && et ? zonedInstant(ed, et, tz) : null;
    if (endAt != null && endAt < startAt) continue;
    const protocol = (cellStr(r.protocol) in PROTOCOLS ? cellStr(r.protocol) : '18:6') as ProtocolId;
    const target = cellNum(r.target_h) ?? PROTOCOLS[protocol].fast;
    // Pause details aren't exported; rebuild one pause so the fasted total matches.
    const pauses: FastSession['pauses'] = [];
    const fastedH = cellNum(r.fasted_h);
    if (endAt != null && fastedH != null) {
      const paused = endAt - startAt - fastedH * HOUR;
      if (paused > 6 * 60_000) pauses.push({ start: endAt - paused, end: endAt });
    }
    const status = endAt != null ? 'ended' : cellStr(r.status) === 'paused' ? 'paused' : 'active';
    if (status === 'paused') pauses.push({ start: now, end: null });
    fasts.push({ id: cellStr(r.id) || uid(), protocol, targetHours: target, startAt, endAt, pauses, status, edited: cellStr(r.edited) === 'yes', createdAt: now, updatedAt: now });
  }
  // Only one fast may be in progress.
  const open = fasts.filter((f) => f.endAt == null).sort((a, b) => b.startAt - a.startAt);
  const drop = new Set(open.slice(1).map((f) => f.id));

  return { fasts: fasts.filter((f) => !drop.has(f.id)), foods, weights: [...weightByDate.values()], water, activities };
}

/** Wrap restored records as a validated backup so the normal import path (with its checks) applies. */
export function backupFromSheet(tables: Tables, tz: string, now = Date.now()): ParseResult {
  const d = recordsFromSheet(tables, tz, now);
  const total = d.fasts.length + d.foods.length + d.weights.length + d.water.length + d.activities.length;
  if (!total) return { ok: false, error: 'no FORM data found in this file' };
  return parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, data: { settings: {}, foodItems: [], meals: [], ...d } }));
}

export async function readSheetFile(file: File): Promise<Tables> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  return Object.fromEntries(sheets.map((s) => [s.sheet, s.data as Cell[][]]));
}
