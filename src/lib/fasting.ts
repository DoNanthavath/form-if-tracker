import type { FastSession, ProtocolId } from './types';
import { HOUR, dateKey, shiftDate, zonedInstant, lastNDates } from './time';

export const PROTOCOLS: Record<ProtocolId, { fast: number; eat: number }> = {
  '12:12': { fast: 12, eat: 12 },
  '14:10': { fast: 14, eat: 10 },
  '16:8': { fast: 16, eat: 8 },
  '18:6': { fast: 18, eat: 6 },
  '20:4': { fast: 20, eat: 4 },
};
export const PROTOCOL_IDS = Object.keys(PROTOCOLS) as ProtocolId[];

export interface Schedule {
  protocol: ProtocolId;
  eatingStart: string; // HH:mm local
}

export interface PlannedPhase {
  phase: 'eating' | 'fasting';
  start: number;
  end: number;
  elapsed: number;
  remaining: number;
  progress: number; // 0..1
}

/** Wall-clock HH:mm at which the planned fast starts (end of eating window). */
export function fastingStartTime(s: Schedule): string {
  const [h, m] = s.eatingStart.split(':').map(Number);
  const total = (h * 60 + m + PROTOCOLS[s.protocol].eat * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Planned eating window for a given local date: [start, end) as instants. */
export function eatingWindow(date: string, s: Schedule, tz: string): { start: number; end: number } {
  const start = zonedInstant(date, s.eatingStart, tz);
  return { start, end: start + PROTOCOLS[s.protocol].eat * HOUR };
}

/**
 * Where `now` falls in the planned (schedule-based) cycle. This is only the plan –
 * it says nothing about whether the user actually fasted.
 */
export function plannedPhase(now: number, s: Schedule, tz: string): PlannedPhase {
  const today = dateKey(now, tz);
  for (const offset of [-1, 0, 1]) {
    const d = shiftDate(today, offset);
    const win = eatingWindow(d, s, tz);
    const nextStart = eatingWindow(shiftDate(d, 1), s, tz).start;
    if (now >= win.start && now < win.end) return mk('eating', win.start, win.end, now);
    if (now >= win.end && now < nextStart) return mk('fasting', win.end, nextStart, now);
  }
  // Unreachable for valid schedules; fall back to a safe value.
  return mk('fasting', now, now + PROTOCOLS[s.protocol].fast * HOUR, now);
}

function mk(phase: 'eating' | 'fasting', start: number, end: number, now: number): PlannedPhase {
  const len = end - start;
  const elapsed = Math.min(Math.max(now - start, 0), len);
  return { phase, start, end, elapsed, remaining: len - elapsed, progress: len > 0 ? elapsed / len : 0 };
}

/* ───────────────────────── Tracked sessions ───────────────────────── */

/** Milliseconds spent paused, up to `now` for an open pause. */
export function pausedMs(session: FastSession, now: number): number {
  return session.pauses.reduce((sum, p) => {
    const end = p.end ?? (session.endAt ?? now);
    return sum + Math.max(0, Math.min(end, session.endAt ?? Infinity) - p.start);
  }, 0);
}

/** Effective fasting time: wall time from start to end/now, minus paused time. */
export function fastedMs(session: FastSession, now: number): number {
  const end = session.endAt ?? now;
  return Math.max(0, end - session.startAt - pausedMs(session, now));
}

export function targetMs(session: FastSession): number {
  return session.targetHours * HOUR;
}

export function sessionProgress(session: FastSession, now: number): number {
  const t = targetMs(session);
  return t > 0 ? Math.min(fastedMs(session, now) / t, 1) : 0;
}

/** Projected instant the target is reached if the fast continues without pauses. */
export function projectedGoalAt(session: FastSession, now: number): number {
  return now + Math.max(0, targetMs(session) - fastedMs(session, now));
}

/**
 * A session counts as completed only when the stored record proves it:
 * it has been ended, end > start, and effective fasted time ≥ target.
 */
export function isVerifiedComplete(session: FastSession): boolean {
  if (session.status !== 'ended' || session.endAt == null) return false;
  if (session.endAt <= session.startAt) return false;
  if (session.pauses.some((p) => p.end == null)) return false;
  return fastedMs(session, session.endAt) >= targetMs(session);
}

/** A session is attributed to the local date on which it ended. */
export function sessionDate(session: FastSession, tz: string): string | null {
  return session.endAt == null ? null : dateKey(session.endAt, tz);
}

export function completedDates(sessions: FastSession[], tz: string): Set<string> {
  const set = new Set<string>();
  for (const s of sessions) if (isVerifiedComplete(s)) set.add(sessionDate(s, tz)!);
  return set;
}

/**
 * Current streak of consecutive local days with ≥1 verified completed fast.
 * If today has none yet, the streak is counted up to yesterday (today is still open).
 */
export function currentStreak(sessions: FastSession[], today: string, tz: string): number {
  const done = completedDates(sessions, tz);
  let d = done.has(today) ? today : shiftDate(today, -1);
  let n = 0;
  while (done.has(d)) {
    n++;
    d = shiftDate(d, -1);
  }
  return n;
}

export function longestStreak(sessions: FastSession[], tz: string): number {
  const days = [...completedDates(sessions, tz)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && shiftDate(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface DayFastStat {
  date: string;
  sessions: number;
  completed: number;
  fastedHours: number; // effective hours of sessions ending that day
  bestProgress: number; // 0..1 best ratio among sessions ending that day
}

export function dailyFastStats(sessions: FastSession[], dates: string[], tz: string): DayFastStat[] {
  const map = new Map<string, DayFastStat>(
    dates.map((d) => [d, { date: d, sessions: 0, completed: 0, fastedHours: 0, bestProgress: 0 }]),
  );
  for (const s of sessions) {
    const d = sessionDate(s, tz);
    const stat = d ? map.get(d) : undefined;
    if (!stat || s.endAt == null) continue;
    stat.sessions++;
    const fasted = fastedMs(s, s.endAt);
    stat.fastedHours += fasted / HOUR;
    stat.bestProgress = Math.max(stat.bestProgress, Math.min(1, fasted / targetMs(s)));
    if (isVerifiedComplete(s)) stat.completed++;
  }
  return dates.map((d) => map.get(d)!);
}

export interface FastSummary {
  completed: number;
  ended: number;
  avgHours: number;
  longestHours: number;
  completionRate: number; // completed / ended
  daysWithCompletion: number;
}

export function summarizeFasts(sessions: FastSession[], today: string, days: number, tz: string): FastSummary {
  const dates = new Set(lastNDates(today, days));
  const ended = sessions.filter((s) => s.endAt != null && dates.has(sessionDate(s, tz)!));
  const hours = ended.map((s) => fastedMs(s, s.endAt!) / HOUR);
  const completed = ended.filter(isVerifiedComplete);
  return {
    completed: completed.length,
    ended: ended.length,
    avgHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0,
    longestHours: hours.length ? Math.max(...hours) : 0,
    completionRate: ended.length ? completed.length / ended.length : 0,
    daysWithCompletion: new Set(completed.map((s) => sessionDate(s, tz))).size,
  };
}

/* ───────────────────────── Session transitions ───────────────────────── */

export function startSession(id: string, protocol: ProtocolId, startAt: number, now: number): FastSession {
  return {
    id,
    protocol,
    targetHours: PROTOCOLS[protocol].fast,
    startAt,
    endAt: null,
    pauses: [],
    status: 'active',
    edited: startAt < now - 60_000,
    createdAt: now,
    updatedAt: now,
  };
}

export function pauseSession(s: FastSession, now: number): FastSession {
  if (s.status !== 'active') return s;
  return { ...s, status: 'paused', pauses: [...s.pauses, { start: now, end: null }], updatedAt: now };
}

export function resumeSession(s: FastSession, now: number): FastSession {
  if (s.status !== 'paused') return s;
  return {
    ...s,
    status: 'active',
    pauses: s.pauses.map((p) => (p.end == null ? { ...p, end: now } : p)),
    updatedAt: now,
  };
}

export function endSession(s: FastSession, endAt: number, now: number): FastSession {
  if (s.status === 'ended') return s;
  const end = Math.max(endAt, s.startAt);
  return {
    ...s,
    status: 'ended',
    endAt: end,
    pauses: s.pauses.map((p) => (p.end == null ? { ...p, end } : p)),
    edited: s.edited || Math.abs(endAt - now) > 60_000,
    updatedAt: now,
  };
}

/** Validate manual edits of start/end. Returns an error key or null. */
export function validateSessionTimes(startAt: number, endAt: number | null, now: number): string | null {
  if (!Number.isFinite(startAt)) return 'errInvalidTime';
  if (startAt > now + 60_000) return 'errFutureStart';
  if (endAt != null) {
    if (!Number.isFinite(endAt)) return 'errInvalidTime';
    if (endAt <= startAt) return 'errEndBeforeStart';
    if (endAt > now + 60_000) return 'errFutureEnd';
    if (endAt - startAt > 7 * 24 * HOUR) return 'errTooLong';
  }
  return null;
}
