import { describe, expect, it } from 'vitest';
import {
  bmr, formatQuantity, kcalFromMacros, parseQuantity, scaleMacros, suggestedBudget, sumMacros, tdee, totalsByDate, totalsForDate,
} from '../src/lib/nutrition';
import type { FoodEntry } from '../src/lib/types';

const entry = (date: string, kcal: number, protein: number, carbs = 0, fat = 0): FoodEntry => ({
  id: Math.random().toString(36), date, time: '12:30', at: 0, mealType: 'lunch', name: 'x', foodItemId: null,
  quantity: 1, unit: '', kcal, protein, carbs, fat, photo: null, notes: '', createdAt: 0, updatedAt: 0,
});

describe('portions', () => {
  it('parses fractions', () => {
    expect(parseQuantity('1/2')).toBe(0.5);
    expect(parseQuantity('3/4')).toBe(0.75);
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('0,25')).toBe(0.25);
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('1/0')).toBeNull();
  });
  it('formats fractions', () => {
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(2)).toBe('2');
    expect(formatQuantity(0.3)).toBe('0.3');
  });
  it('scales macros by servings', () => {
    expect(scaleMacros({ kcal: 450, protein: 28, carbs: 55, fat: 12 }, 0.5)).toEqual({ kcal: 225, protein: 14, carbs: 27.5, fat: 6 });
    expect(scaleMacros({ kcal: 200, protein: 4, carbs: 44, fat: 0.5 }, 0.75)).toEqual({ kcal: 150, protein: 3, carbs: 33, fat: 0.4 });
    expect(scaleMacros({ kcal: 100, protein: 1, carbs: 1, fat: 1 }, -1).kcal).toBe(0);
  });
});

describe('daily totals', () => {
  const list = [entry('2026-03-10', 450, 28, 55, 12), entry('2026-03-10', 200, 4.3, 44, 0.5), entry('2026-03-11', 300, 30)];
  it('sums one day only', () => {
    expect(totalsForDate(list, '2026-03-10')).toEqual({ kcal: 650, protein: 32.3, carbs: 99, fat: 12.5 });
    expect(totalsForDate(list, '2026-03-12')).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
  it('updates when entries change', () => {
    const edited = list.map((e, i) => (i === 0 ? { ...e, kcal: 225, protein: 14 } : e));
    expect(totalsForDate(edited, '2026-03-10').kcal).toBe(425);
    expect(totalsForDate(list.slice(1), '2026-03-10').kcal).toBe(200);
  });
  it('groups by date', () => {
    const m = totalsByDate(list);
    expect(m.get('2026-03-11')?.protein).toBe(30);
  });
  it('avoids floating point drift', () => {
    expect(sumMacros([{ kcal: 0, protein: 0.1, carbs: 0, fat: 0 }, { kcal: 0, protein: 0.2, carbs: 0, fat: 0 }]).protein).toBe(0.3);
  });
  it('energy from macros', () => expect(kcalFromMacros({ protein: 10, carbs: 10, fat: 10 })).toBe(170));
});

describe('energy estimation', () => {
  const base = { age: 31, heightCm: 168, weightKg: 85, bodyFatPct: null };
  it('Mifflin-St Jeor', () => {
    expect(bmr({ ...base, formula: 'mifflin', sex: 'male' })).toBe(1750);
    expect(bmr({ ...base, formula: 'mifflin', sex: 'female' })).toBe(1584);
    expect(bmr({ ...base, formula: 'mifflin', sex: 'unset' })).toBeNull();
  });
  it('Harris-Benedict (revised)', () => expect(bmr({ ...base, formula: 'harris', sex: 'male' })).toBe(1857));
  it('Katch-McArdle needs body fat', () => {
    expect(bmr({ ...base, formula: 'katch', sex: 'unset' })).toBeNull();
    expect(bmr({ ...base, formula: 'katch', sex: 'unset', bodyFatPct: 30 })).toBe(1655);
  });
  it('TDEE & budget', () => {
    expect(tdee(1750, 'light')).toBe(2406);
    expect(suggestedBudget(2406, 0.5)).toBe(1860);
  });
});
