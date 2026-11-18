import { TZDate } from '@date-fns/tz';
import { addDays, format, parseISO, differenceInCalendarDays } from 'date-fns';

export const DEFAULT_TZ = 'Asia/Vientiane';
export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const DAY = 86_400_000;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date (yyyy-MM-dd) of an instant in the given time zone. */
export function dateKey(ms: number, tz: string): string {
  return format(new TZDate(ms, tz), 'yyyy-MM-dd');
}

/** Local wall-clock time (HH:mm) of an instant in the given time zone. */
export function timeKey(ms: number, tz: string): string {
  return format(new TZDate(ms, tz), 'HH:mm');
}

export function parseHm(hm: string): { h: number; m: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) throw new Error(`Invalid time "${hm}"`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Invalid time "${hm}"`);
  return { h, m };
}

/** Epoch ms of a local wall-clock time on a local date in the given zone. */
export function zonedInstant(date: string, hm: string, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const { h, m } = parseHm(hm);
  return new TZDate(y, mo - 1, d, h, m, 0, 0, tz).getTime();
}

/** Start-of-day instant for a local date in the zone. */
export function startOfLocalDay(date: string, tz: string): number {
  return zonedInstant(date, '00:00', tz);
}

export function shiftDate(date: string, days: number): string {
  return format(addDays(parseISO(date), days), 'yyyy-MM-dd');
}

export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(b), parseISO(a));
}

/** Inclusive list of local dates ending at `end`. */
export function lastNDates(end: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftDate(end, -i));
  return out;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a local date. */
export function isoWeekday(date: string): number {
  const d = parseISO(date).getDay();
  return d === 0 ? 7 : d;
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  return shiftDate(date, 1 - isoWeekday(date));
}

export function formatDuration(ms: number, withSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return withSeconds ? `${h}:${pad(m)}:${pad(s)}` : `${h}:${pad(m)}`;
}

export function hoursLabel(ms: number): string {
  return (ms / HOUR).toFixed(1);
}
