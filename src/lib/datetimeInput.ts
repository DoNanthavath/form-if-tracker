import { dateKey, timeKey, zonedInstant } from './time';

/** Value for <input type="datetime-local"> expressed in the app time zone. */
export function toInputValue(ms: number, tz: string): string {
  return `${dateKey(ms, tz)}T${timeKey(ms, tz)}`;
}

export function fromInputValue(v: string, tz: string): number {
  const [d, t] = v.split('T');
  if (!d || !t) return NaN;
  try {
    return zonedInstant(d, t.slice(0, 5), tz);
  } catch {
    return NaN;
  }
}
