import type { Settings } from '../lib/types';
import { DEFAULT_TZ, dateKey } from '../lib/time';

export function defaultSettings(now = Date.now()): Settings {
  return {
    lang: 'th',
    theme: 'dark',
    timeZone: DEFAULT_TZ,
    age: 31,
    sex: 'unset',
    heightCm: 168,
    activityLevel: 'light',
    bodyFatPct: null,
    startWeightKg: 85,
    startDate: dateKey(now, DEFAULT_TZ),
    goalWeightsKg: [80, 75, 70],
    kcalBudget: 1900,
    proteinG: 120,
    carbsG: null,
    fatG: null,
    bmrFormula: 'mifflin',
    weeklyLossTargetKg: 0.5,
    protocol: '18:6',
    eatingStart: '12:00',
    waterTargetMl: 2500,
    lastExportAt: null,
    onboarded: false,
  };
}
