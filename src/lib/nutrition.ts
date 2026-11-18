import type { ActivityLevel, BmrFormula, FoodEntry, Macros, MealType, Sex } from './types';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'];
export const PORTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Scale per-serving macros by a quantity (number of servings). */
export function scaleMacros(per: Macros, quantity: number): Macros {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  return {
    kcal: Math.round(per.kcal * q),
    protein: round1(per.protein * q),
    carbs: round1(per.carbs * q),
    fat: round1(per.fat * q),
  };
}

export function sumMacros(items: Macros[]): Macros {
  const t = items.reduce(
    (acc, x) => ({
      kcal: acc.kcal + (x.kcal || 0),
      protein: acc.protein + (x.protein || 0),
      carbs: acc.carbs + (x.carbs || 0),
      fat: acc.fat + (x.fat || 0),
    }),
    { ...ZERO },
  );
  return { kcal: Math.round(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
}

export function totalsForDate(entries: FoodEntry[], date: string): Macros {
  return sumMacros(entries.filter((e) => e.date === date));
}

export function totalsByDate(entries: FoodEntry[]): Map<string, Macros> {
  const groups = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const g = groups.get(e.date);
    if (g) g.push(e);
    else groups.set(e.date, [e]);
  }
  return new Map([...groups].map(([d, list]) => [d, sumMacros(list)]));
}

export function totalsByMeal(entries: FoodEntry[]): Record<MealType, Macros> {
  const out = {} as Record<MealType, Macros>;
  for (const m of MEAL_TYPES) out[m] = sumMacros(entries.filter((e) => e.mealType === m));
  return out;
}

/** Energy from macros (4/4/9). Useful to sanity-check manual entries. */
export function kcalFromMacros(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);
}

/** Parse "1/2", "0.5", "1 1/2", "1,5" into a number. */
export function parseQuantity(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (!s) return null;
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const den = Number(mixed[3]);
    return den ? Number(mixed[1]) + Number(mixed[2]) / den : null;
  }
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const den = Number(frac[2]);
    return den ? Number(frac[1]) / den : null;
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatQuantity(q: number): string {
  const glyph: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
  const whole = Math.floor(q + 1e-9);
  const rem = Math.round((q - whole) * 100) / 100;
  if (rem === 0) return String(whole);
  if (glyph[rem]) return whole ? `${whole}${glyph[rem]}` : glyph[rem];
  return String(Math.round(q * 100) / 100);
}

/* ───────────────────────── Energy estimation ───────────────────────── */

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export interface BmrInput {
  formula: BmrFormula;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
}

/** Basal metabolic rate (kcal/day). Returns null when inputs are insufficient. */
export function bmr(i: BmrInput): number | null {
  if (!(i.weightKg > 0 && i.heightCm > 0 && i.age > 0)) return null;
  switch (i.formula) {
    case 'mifflin': {
      if (i.sex === 'unset') return null;
      const base = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age;
      return Math.round(base + (i.sex === 'male' ? 5 : -161));
    }
    case 'harris': {
      // Roza & Shizgal (1984) revision
      if (i.sex === 'male') return Math.round(88.362 + 13.397 * i.weightKg + 4.799 * i.heightCm - 5.677 * i.age);
      if (i.sex === 'female') return Math.round(447.593 + 9.247 * i.weightKg + 3.098 * i.heightCm - 4.33 * i.age);
      return null;
    }
    case 'katch': {
      if (i.bodyFatPct == null || !(i.bodyFatPct > 2 && i.bodyFatPct < 70)) return null;
      const lbm = i.weightKg * (1 - i.bodyFatPct / 100);
      return Math.round(370 + 21.6 * lbm);
    }
  }
}

export function tdee(bmrKcal: number, level: ActivityLevel): number {
  return Math.round(bmrKcal * ACTIVITY_FACTORS[level]);
}

/** ~7,700 kcal per kg of body-weight change (a rough, commonly used approximation). */
export const KCAL_PER_KG = 7700;

export function suggestedBudget(tdeeKcal: number, weeklyLossKg: number): number {
  const deficit = (weeklyLossKg * KCAL_PER_KG) / 7;
  return Math.round((tdeeKcal - deficit) / 10) * 10;
}
