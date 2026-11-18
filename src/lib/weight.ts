import type { WeightEntry } from './types';
import { DAY, daysBetween, shiftDate } from './time';
import { round1 } from './nutrition';

export function bmi(kg: number, heightCm: number): number | null {
  if (!(kg > 0 && heightCm > 0)) return null;
  const m = heightCm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

/** WHO adult categories; Asian populations often use lower cut-offs (23 / 27.5). */
export function bmiCategory(v: number): 'under' | 'normal' | 'over' | 'obese' {
  if (v < 18.5) return 'under';
  if (v < 25) return 'normal';
  if (v < 30) return 'over';
  return 'obese';
}

export function sortByDate(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export function latest(entries: WeightEntry[]): WeightEntry | null {
  const s = sortByDate(entries);
  return s.length ? s[s.length - 1] : null;
}

/** Mean of entries whose date falls within the 7 days ending at `end` (inclusive). */
export function averageInWindow(entries: WeightEntry[], end: string, days = 7): number | null {
  const start = shiftDate(end, -(days - 1));
  const vals = entries.filter((e) => e.date >= start && e.date <= end).map((e) => e.kg);
  return vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

/** Trailing 7-day moving average for each entry date. */
export function movingAverage(entries: WeightEntry[], days = 7): { date: string; kg: number; avg: number }[] {
  const s = sortByDate(entries);
  return s.map((e) => ({ date: e.date, kg: e.kg, avg: averageInWindow(s, e.date, days)! }));
}

/**
 * Change between the 7-day average ending today and the 7-day average ending `days` ago.
 * Averages smooth out daily water-weight noise. Negative = loss.
 */
export function changeOver(entries: WeightEntry[], today: string, days: number): number | null {
  const now = averageInWindow(entries, today);
  const before = averageInWindow(entries, shiftDate(today, -days));
  if (now == null || before == null) return null;
  return round1(now - before);
}

export interface GoalProgress {
  start: number;
  current: number;
  goal: number;
  lost: number; // positive = lost
  remaining: number; // ≥ 0
  progress: number; // 0..1
  reached: boolean;
}

export function goalProgress(start: number, current: number, goal: number): GoalProgress {
  const total = start - goal;
  const lost = round1(start - current);
  const progress = total > 0 ? Math.min(1, Math.max(0, lost / total)) : current <= goal ? 1 : 0;
  return {
    start,
    current,
    goal,
    lost,
    remaining: round1(Math.max(0, current - goal)),
    progress,
    reached: current <= goal,
  };
}

/** Next goal not yet reached, from an ordered list like [80, 75, 70]. */
export function activeGoal(goals: number[], current: number): number | null {
  const sorted = [...goals].sort((a, b) => b - a);
  return sorted.find((g) => current > g) ?? null;
}

/**
 * Linear-regression slope (kg/week) over the given trailing window.
 * Requires ≥4 entries spanning ≥10 days; otherwise null.
 */
export function trendPerWeek(entries: WeightEntry[], today: string, windowDays = 28): number | null {
  const start = shiftDate(today, -(windowDays - 1));
  const pts = sortByDate(entries).filter((e) => e.date >= start && e.date <= today);
  if (pts.length < 4) return null;
  if (daysBetween(pts[0].date, pts[pts.length - 1].date) < 10) return null;
  const xs = pts.map((p) => daysBetween(pts[0].date, p.date));
  const ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  if (den === 0) return null;
  return Math.round((num / den) * 7 * 100) / 100;
}

/** Rough, non-guaranteed estimate of weeks to reach a goal at the current trend. */
export function weeksToGoalEstimate(current: number, goal: number, perWeek: number | null): number | null {
  if (perWeek == null || perWeek >= -0.05 || current <= goal) return null;
  return Math.ceil((current - goal) / -perWeek);
}

export const MS_PER_DAY = DAY;
