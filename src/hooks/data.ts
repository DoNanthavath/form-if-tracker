import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { shiftDate } from '../lib/time';
import type { ActivityEntry, FastSession, FoodEntry, FoodItem, SavedMeal, WaterEntry, WeightEntry } from '../lib/types';

const EMPTY: never[] = [];

export function useFasts(): FastSession[] {
  return useLiveQuery(() => db.fasts.orderBy('startAt').reverse().toArray(), []) ?? EMPTY;
}
export function useActiveFast(): FastSession | null | undefined {
  return useLiveQuery(() => db.fasts.where('status').anyOf('active', 'paused').first().then((x) => x ?? null), []);
}
export function useFoodsOn(date: string): FoodEntry[] | undefined {
  return useLiveQuery(() => db.foods.where('date').equals(date).sortBy('time'), [date]);
}
export function useFoodsSince(days: number, today: string): FoodEntry[] {
  return useLiveQuery(() => db.foods.where('date').between(shiftDate(today, -(days - 1)), today, true, true).toArray(), [days, today]) ?? EMPTY;
}
export function useRecentFoods(limit = 40): FoodEntry[] {
  return useLiveQuery(() => db.foods.orderBy('at').reverse().limit(limit).toArray(), [limit]) ?? EMPTY;
}
export function useFoodItems(): FoodItem[] {
  return useLiveQuery(() => db.foodItems.toArray(), []) ?? EMPTY;
}
export function useMeals(): SavedMeal[] {
  return useLiveQuery(() => db.meals.orderBy('name').toArray(), []) ?? EMPTY;
}
export function useWeights(): WeightEntry[] | undefined {
  return useLiveQuery(() => db.weights.orderBy('date').toArray(), []);
}
export function useWaterSince(days: number, today: string): WaterEntry[] {
  return useLiveQuery(() => db.water.where('date').between(shiftDate(today, -(days - 1)), today, true, true).toArray(), [days, today]) ?? EMPTY;
}
export function useActivitiesSince(days: number, today: string): ActivityEntry[] {
  return useLiveQuery(() => db.activities.where('date').between(shiftDate(today, -(days - 1)), today, true, true).reverse().sortBy('at'), [days, today]) ?? EMPTY;
}
