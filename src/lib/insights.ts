import type { FastSession, FoodEntry, MealType, Settings, WaterEntry, WeightEntry } from './types';
import { dailyFastStats, plannedPhase } from './fasting';
import { MEAL_TYPES, round1, sumMacros } from './nutrition';
import { weekStart } from './time';

export interface DayRow {
  date: string;
  kcal: number;
  protein: number;
  logged: boolean;
  fastHours: number;
  fastCompleted: boolean;
  water: number;
  weight: number | null;
}

export interface GroupRow {
  key: string;
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  completedFasts: number;
  avgWeight: number | null;
}

export interface Insights {
  days: DayRow[];
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  adherence: { withinBudget: number | null; proteinHit: number | null; fasts: number; water: number };
  byMeal: Record<MealType, number>;
  inWindowPct: number | null;
  weekly: GroupRow[];
  monthly: GroupRow[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeInsights(input: {
  dates: string[];
  foods: FoodEntry[];
  fasts: FastSession[];
  weights: WeightEntry[];
  water: WaterEntry[];
  settings: Pick<Settings, 'kcalBudget' | 'proteinG' | 'waterTargetMl' | 'protocol' | 'eatingStart'>;
  tz: string;
}): Insights {
  const { dates, foods, fasts, weights, water, settings, tz } = input;
  const inRange = new Set(dates);
  const f = foods.filter((e) => inRange.has(e.date));
  const fastStats = new Map(dailyFastStats(fasts, dates, tz).map((s) => [s.date, s]));
  const weightBy = new Map(weights.map((w) => [w.date, w.kg]));

  const days: DayRow[] = dates.map((date) => {
    const list = f.filter((e) => e.date === date);
    const tot = sumMacros(list);
    const fs = fastStats.get(date)!;
    return {
      date,
      kcal: tot.kcal,
      protein: tot.protein,
      logged: list.length > 0,
      fastHours: round1(fs.fastedHours),
      fastCompleted: fs.completed > 0,
      water: water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0),
      weight: weightBy.get(date) ?? null,
    };
  });

  const logged = days.filter((d) => d.logged);
  const pct = (n: number, d: number) => (d ? n / d : null);

  const byMeal = {} as Record<MealType, number>;
  for (const m of MEAL_TYPES) {
    const k = f.filter((e) => e.mealType === m).reduce((a, e) => a + e.kcal, 0);
    byMeal[m] = logged.length ? Math.round(k / logged.length) : 0;
  }

  // Entries with real energy (exclude near-zero drinks such as black coffee)
  const caloric = f.filter((e) => e.kcal > 15);
  const inWindow = caloric.filter((e) => plannedPhase(e.at, settings, tz).phase === 'eating').length;

  const group = (keyOf: (d: string) => string): GroupRow[] => {
    const map = new Map<string, DayRow[]>();
    for (const d of days) {
      const k = keyOf(d.date);
      map.set(k, [...(map.get(k) ?? []), d]);
    }
    return [...map].map(([key, rows]) => {
      const lg = rows.filter((r) => r.logged);
      const ws = rows.map((r) => r.weight).filter((x): x is number => x != null);
      const ak = avg(lg.map((r) => r.kcal));
      const ap = avg(lg.map((r) => r.protein));
      const aw = avg(ws);
      return {
        key,
        loggedDays: lg.length,
        avgKcal: ak == null ? null : Math.round(ak),
        avgProtein: ap == null ? null : round1(ap),
        completedFasts: rows.filter((r) => r.fastCompleted).length,
        avgWeight: aw == null ? null : round1(aw),
      };
    });
  };

  const ak = avg(logged.map((d) => d.kcal));
  const ap = avg(logged.map((d) => d.protein));
  return {
    days,
    loggedDays: logged.length,
    avgKcal: ak == null ? null : Math.round(ak),
    avgProtein: ap == null ? null : round1(ap),
    adherence: {
      withinBudget: pct(logged.filter((d) => d.kcal <= settings.kcalBudget).length, logged.length),
      proteinHit: pct(logged.filter((d) => d.protein >= settings.proteinG * 0.9).length, logged.length),
      fasts: days.filter((d) => d.fastCompleted).length / Math.max(1, days.length),
      water: settings.waterTargetMl > 0 ? days.filter((d) => d.water >= settings.waterTargetMl).length / Math.max(1, days.length) : 0,
    },
    byMeal,
    inWindowPct: pct(inWindow, caloric.length),
    weekly: group(weekStart),
    monthly: group((d) => d.slice(0, 7)),
  };
}
