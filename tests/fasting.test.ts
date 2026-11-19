import { describe, expect, it } from 'vitest';
import {
  currentStreak, dailyFastStats, endSession, fastedMs, fastingStartTime, isVerifiedComplete, longestStreak,
  pauseSession, plannedPhase, resumeSession, startSession, summarizeFasts, validateSessionTimes,
} from '../src/lib/fasting';
import { HOUR, MINUTE, dateKey, zonedInstant } from '../src/lib/time';
import type { FastSession } from '../src/lib/types';

const TZ = 'Asia/Vientiane'; // UTC+7, no DST
const at = (date: string, hm: string, tz = TZ) => zonedInstant(date, hm, tz);
const sched = { protocol: '18:6' as const, eatingStart: '12:00' };

describe('time zone helpers', () => {
  it('maps Vientiane wall-clock to UTC (+7)', () => {
    expect(new Date(at('2026-03-10', '12:00')).toISOString()).toBe('2026-03-10T05:00:00.000Z');
  });
  it('local date boundary follows the zone, not UTC', () => {
    // 23:30 local on Mar 10 is 16:30Z the same day; 00:30 local Mar 11 is 17:30Z Mar 10.
    expect(dateKey(at('2026-03-10', '23:30'), TZ)).toBe('2026-03-10');
    expect(dateKey(at('2026-03-11', '00:30'), TZ)).toBe('2026-03-11');
    expect(new Date(at('2026-03-11', '00:30')).toISOString()).toBe('2026-03-10T17:30:00.000Z');
  });
});

describe('planned 18:6 schedule', () => {
  it('fasting starts at 18:00', () => expect(fastingStartTime(sched)).toBe('18:00'));
  it('wraps the end time past midnight for late windows', () =>
    expect(fastingStartTime({ protocol: '16:8', eatingStart: '20:00' })).toBe('04:00'));

  it('is eating between 12:00 and 18:00', () => {
    const p = plannedPhase(at('2026-03-10', '15:00'), sched, TZ);
    expect(p.phase).toBe('eating');
    expect(p.start).toBe(at('2026-03-10', '12:00'));
    expect(p.end).toBe(at('2026-03-10', '18:00'));
    expect(p.progress).toBeCloseTo(0.5);
  });

  it('fasting window crosses midnight: 23:59 and 00:01 belong to the same fast', () => {
    const a = plannedPhase(at('2026-03-10', '23:59'), sched, TZ);
    const b = plannedPhase(at('2026-03-11', '00:01'), sched, TZ);
    expect(a.phase).toBe('fasting');
    expect(b.phase).toBe('fasting');
    expect(a.start).toBe(b.start);
    expect(a.start).toBe(at('2026-03-10', '18:00'));
    expect(a.end).toBe(at('2026-03-11', '12:00'));
    expect(b.remaining).toBe(at('2026-03-11', '12:00') - at('2026-03-11', '00:01'));
  });

  it('boundaries: 18:00 starts fasting, 12:00 starts eating', () => {
    expect(plannedPhase(at('2026-03-10', '18:00'), sched, TZ).phase).toBe('fasting');
    expect(plannedPhase(at('2026-03-11', '12:00'), sched, TZ).phase).toBe('eating');
    expect(plannedPhase(at('2026-03-11', '11:59'), sched, TZ).phase).toBe('fasting');
  });

  it('works across month and year ends', () => {
    const p = plannedPhase(at('2027-01-01', '06:00'), sched, TZ);
    expect(p.phase).toBe('fasting');
    expect(p.start).toBe(at('2026-12-31', '18:00'));
  });

  it('DST zones: a fast across the spring-forward night is 1h shorter in wall time', () => {
    const ny = 'America/New_York'; // DST starts 2026-03-08 02:00
    const p = plannedPhase(at('2026-03-08', '03:30', ny), sched, ny);
    expect(p.phase).toBe('fasting');
    expect(p.end - p.start).toBe(17 * HOUR);
    expect(new Date(p.end).toISOString()).toBe('2026-03-08T16:00:00.000Z'); // 12:00 EDT
  });
});

function session(startAt: number, endAt: number | null, target = 18, pauses: FastSession['pauses'] = []): FastSession {
  return {
    id: Math.random().toString(36), protocol: '18:6', targetHours: target, startAt, endAt, pauses,
    status: endAt == null ? 'active' : 'ended', edited: false, createdAt: startAt, updatedAt: startAt,
  };
}

describe('tracked sessions', () => {
  it('measures elapsed from timestamps, independent of timers', () => {
    const s = session(at('2026-03-10', '18:00'), null);
    expect(fastedMs(s, at('2026-03-11', '06:00'))).toBe(12 * HOUR);
  });

  it('pause/resume excludes paused time', () => {
    const t0 = at('2026-03-10', '18:00');
    let s = startSession('a', '18:6', t0, t0);
    s = pauseSession(s, t0 + 2 * HOUR);
    expect(fastedMs(s, t0 + 3 * HOUR)).toBe(2 * HOUR); // still paused
    s = resumeSession(s, t0 + 3 * HOUR);
    expect(fastedMs(s, t0 + 5 * HOUR)).toBe(4 * HOUR);
  });

  it('only verifies completion when the stored record reaches the target', () => {
    const t0 = at('2026-03-10', '18:00');
    const ok = endSession(startSession('a', '18:6', t0, t0), t0 + 18 * HOUR, t0 + 18 * HOUR);
    expect(isVerifiedComplete(ok)).toBe(true);
    const short = endSession(startSession('b', '18:6', t0, t0), t0 + 18 * HOUR - MINUTE, t0 + 18 * HOUR);
    expect(isVerifiedComplete(short)).toBe(false);
    const active = startSession('c', '18:6', t0, t0);
    expect(isVerifiedComplete(active)).toBe(false); // even if lots of time has passed
    let paused = pauseSession(startSession('d', '18:6', t0, t0), t0 + HOUR);
    paused = resumeSession(paused, t0 + 2 * HOUR);
    paused = endSession(paused, t0 + 18 * HOUR, t0 + 18 * HOUR);
    expect(isVerifiedComplete(paused)).toBe(false); // 17h effective
  });

  it('ending while paused closes the open pause', () => {
    const t0 = at('2026-03-10', '18:00');
    let s = pauseSession(startSession('a', '18:6', t0, t0), t0 + 10 * HOUR);
    s = endSession(s, t0 + 20 * HOUR, t0 + 20 * HOUR);
    expect(s.pauses[0].end).toBe(t0 + 20 * HOUR);
    expect(fastedMs(s, Infinity)).toBe(10 * HOUR);
  });

  it('validates manual edits', () => {
    const now = at('2026-03-11', '12:00');
    expect(validateSessionTimes(now - HOUR, now - 2 * HOUR, now)).toBe('errEndBeforeStart');
    expect(validateSessionTimes(now + HOUR, null, now)).toBe('errFutureStart');
    expect(validateSessionTimes(now - 18 * HOUR, now, now)).toBeNull();
  });
});

describe('streaks & statistics', () => {
  const days = ['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10'];
  const done = days.map((d) => {
    const start = at(d, '18:00') - 24 * HOUR; // previous evening
    return session(start, start + 18 * HOUR);
  });

  it('attributes a session to the local date it ended', () => {
    const stats = dailyFastStats(done, days, TZ);
    expect(stats.map((s) => s.completed)).toEqual([1, 1, 1, 1]);
  });

  it('counts consecutive completed days and tolerates an unfinished today', () => {
    expect(currentStreak(done, '2026-03-10', TZ)).toBe(4);
    expect(currentStreak(done, '2026-03-11', TZ)).toBe(4); // today not done yet
    expect(currentStreak(done, '2026-03-12', TZ)).toBe(0); // yesterday missed
    const gap = done.filter((_, i) => i !== 1);
    expect(currentStreak(gap, '2026-03-10', TZ)).toBe(2);
    expect(longestStreak(gap, TZ)).toBe(2);
  });

  it('a failed fast does not count toward the streak', () => {
    const start = at('2026-03-10', '18:00');
    const fail = session(start, start + 10 * HOUR);
    expect(currentStreak([fail], '2026-03-11', TZ)).toBe(0);
  });

  it('summarizes completion rate', () => {
    const start = at('2026-03-10', '18:00');
    const fail = session(start, start + 10 * HOUR);
    const s = summarizeFasts([...done, fail], '2026-03-11', 7, TZ);
    expect(s.ended).toBe(5);
    expect(s.completed).toBe(4);
    expect(s.completionRate).toBeCloseTo(0.8);
    expect(s.longestHours).toBe(18);
  });
});

import { endTimeSuggestions, goalReachedAt } from '../src/lib/fasting';
describe('goal time & end suggestions (fast left running)', () => {
  // Started Wed 18 Nov 18:00, never ended; now Thu 19 Nov 23:06
  const startAt = at('2026-11-18', '18:00');
  const now = at('2026-11-19', '23:06');
  const s = session(startAt, null);
  it('goal time is when 18h was actually reached, not "now"', () => {
    expect(goalReachedAt(s, now)).toBe(at('2026-11-19', '12:00'));
  });
  it('goal time before reaching is a projection and accounts for pauses', () => {
    const early = at('2026-11-19', '06:00');
    expect(goalReachedAt(s, early)).toBe(at('2026-11-19', '12:00'));
    const paused = { ...s, pauses: [{ start: at('2026-11-19', '00:00'), end: at('2026-11-19', '01:00') }] };
    expect(goalReachedAt(paused, now)).toBe(at('2026-11-19', '13:00'));
  });
  it('suggests the planned eating start and first logged meal', () => {
    const sug = endTimeSuggestions(s, now, sched, TZ, [at('2026-11-18', '17:00'), at('2026-11-19', '22:53'), at('2026-11-19', '12:40')]);
    expect(sug.planned).toBe(at('2026-11-19', '12:00'));
    expect(sug.firstFood).toBe(at('2026-11-19', '12:40'));
  });
  it('ending at the planned time records a verified 18h fast', () => {
    const ended = endSession(s, at('2026-11-19', '12:00'), now);
    expect(isVerifiedComplete(ended)).toBe(true);
    expect(fastedMs(ended, ended.endAt!)).toBe(18 * HOUR);
    expect(ended.edited).toBe(true);
  });
});
