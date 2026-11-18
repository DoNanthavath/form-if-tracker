import { describe, expect, it } from 'vitest';
import { activeGoal, averageInWindow, bmi, changeOver, goalProgress, trendPerWeek, weeksToGoalEstimate } from '../src/lib/weight';
import { shiftDate } from '../src/lib/time';
import type { WeightEntry } from '../src/lib/types';

const w = (date: string, kg: number): WeightEntry => ({ id: date, date, kg, waistCm: null, note: '', createdAt: 0, updatedAt: 0 });

describe('weight', () => {
  it('BMI', () => expect(bmi(85, 168)).toBe(30.1));
  it('goal progress', () => {
    const g = goalProgress(85, 82.5, 80);
    expect(g.lost).toBe(2.5);
    expect(g.remaining).toBe(2.5);
    expect(g.progress).toBe(0.5);
    expect(goalProgress(85, 86, 80).progress).toBe(0);
    expect(goalProgress(85, 79, 80).reached).toBe(true);
  });
  it('next goal', () => {
    expect(activeGoal([80, 75, 70], 84)).toBe(80);
    expect(activeGoal([80, 75, 70], 79.9)).toBe(75);
    expect(activeGoal([80, 75, 70], 69)).toBeNull();
  });
  const series = Array.from({ length: 28 }, (_, i) => w(shiftDate('2026-03-01', i), Math.round((85 - i * 0.08) * 10) / 10));
  it('7-day average', () => expect(averageInWindow(series, '2026-03-07')).toBe(84.8));
  it('weekly change uses averages', () => expect(changeOver(series, '2026-03-28', 7)).toBeCloseTo(-0.5, 1));
  it('trend & non-guaranteed estimate', () => {
    const t = trendPerWeek(series, '2026-03-28')!;
    expect(t).toBeCloseTo(-0.56, 1);
    expect(weeksToGoalEstimate(82.8, 80, t)).toBeGreaterThan(0);
    expect(weeksToGoalEstimate(82.8, 80, 0.1)).toBeNull();
    expect(trendPerWeek(series.slice(0, 3), '2026-03-03')).toBeNull();
  });
});
