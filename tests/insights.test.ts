import { describe, expect, it } from 'vitest';
import { computeInsights } from '../src/lib/insights';
import { zonedInstant, HOUR } from '../src/lib/time';
import type { FoodEntry } from '../src/lib/types';

const TZ = 'Asia/Vientiane';
const food = (date: string, time: string, kcal: number, protein: number): FoodEntry => ({
  id: `${date}${time}${kcal}`, date, time, at: zonedInstant(date, time, TZ), mealType: 'lunch', name: 'x', foodItemId: null,
  quantity: 1, unit: '', kcal, protein, carbs: 0, fat: 0, photo: null, notes: '', createdAt: 0, updatedAt: 0,
});

describe('insights', () => {
  const settings = { kcalBudget: 1900, proteinG: 120, waterTargetMl: 2000, protocol: '18:6' as const, eatingStart: '12:00' };
  const dates = ['2026-03-09', '2026-03-10', '2026-03-11'];
  const start = zonedInstant('2026-03-09', '18:00', TZ);
  const ins = computeInsights({
    dates, tz: TZ, settings, weights: [],
    foods: [food('2026-03-09', '12:30', 1500, 120), food('2026-03-10', '13:00', 2100, 100), food('2026-03-10', '20:00', 300, 5)],
    fasts: [{ id: 'a', protocol: '18:6', targetHours: 18, startAt: start, endAt: start + 18 * HOUR, pauses: [], status: 'ended', edited: false, createdAt: 0, updatedAt: 0 }],
    water: [{ id: 'w', date: '2026-03-11', at: 0, ml: 2000 }],
  });
  it('averages only logged days', () => {
    expect(ins.loggedDays).toBe(2);
    expect(ins.avgKcal).toBe(1950);
  });
  it('adherence', () => {
    expect(ins.adherence.withinBudget).toBe(0.5);
    expect(ins.adherence.proteinHit).toBe(0.5);
    expect(ins.adherence.fasts).toBeCloseTo(1 / 3);
    expect(ins.adherence.water).toBeCloseTo(1 / 3);
  });
  it('share of entries in the planned eating window', () => expect(ins.inWindowPct).toBeCloseTo(2 / 3));
});
