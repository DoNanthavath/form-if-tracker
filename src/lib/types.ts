export type Lang = 'th' | 'en';
export type ThemePref = 'dark' | 'light' | 'system';
export type Sex = 'male' | 'female' | 'unset';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type BmrFormula = 'mifflin' | 'harris' | 'katch';
export type ProtocolId = '12:12' | '14:10' | '16:8' | '18:6' | '20:4';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink';

export interface Settings {
  lang: Lang;
  theme: ThemePref;
  timeZone: string;
  // profile
  age: number;
  sex: Sex;
  heightCm: number;
  activityLevel: ActivityLevel;
  bodyFatPct: number | null;
  startWeightKg: number;
  startDate: string; // yyyy-MM-dd
  goalWeightsKg: number[]; // ordered milestones e.g. [80, 75, 70]
  // nutrition
  kcalBudget: number;
  proteinG: number;
  carbsG: number | null;
  fatG: number | null;
  bmrFormula: BmrFormula;
  weeklyLossTargetKg: number;
  // fasting
  protocol: ProtocolId;
  eatingStart: string; // HH:mm
  // water
  waterTargetMl: number;
  // housekeeping
  lastExportAt: number | null;
  onboarded: boolean;
}

export interface FastPause {
  start: number; // epoch ms
  end: number | null;
}

export type FastStatus = 'active' | 'paused' | 'ended';

export interface FastSession {
  id: string;
  protocol: ProtocolId;
  targetHours: number;
  startAt: number;
  endAt: number | null;
  pauses: FastPause[];
  status: FastStatus;
  edited: boolean; // times were changed manually after the fact
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem extends Macros {
  id: string;
  nameTh: string;
  nameEn: string;
  servingTh: string; // description of one serving
  servingEn: string;
  category: 'meal' | 'side' | 'fruit' | 'drink' | 'snack' | 'protein' | 'custom';
  builtin: boolean;
  updatedAt: number;
}

export interface FoodEntry extends Macros {
  id: string;
  date: string; // local yyyy-MM-dd (in settings time zone)
  time: string; // HH:mm local
  at: number; // epoch ms
  mealType: MealType;
  name: string;
  foodItemId: string | null;
  quantity: number; // number of servings, e.g. 0.5
  unit: string; // serving description
  photo: string | null; // compressed JPEG data URL
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedMealItem extends Macros {
  name: string;
  quantity: number;
  unit: string;
  foodItemId: string | null;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: number;
  updatedAt: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
  waistCm: number | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface WaterEntry {
  id: string;
  date: string;
  at: number;
  ml: number;
}

export type ActivityType = 'walk' | 'run' | 'cycling' | 'strength' | 'yoga' | 'sport' | 'steps' | 'other';

export interface ActivityEntry {
  id: string;
  date: string;
  at: number;
  type: ActivityType;
  minutes: number | null;
  steps: number | null;
  kcal: number | null; // optional user-provided estimate
  note: string;
  createdAt: number;
  updatedAt: number;
}
