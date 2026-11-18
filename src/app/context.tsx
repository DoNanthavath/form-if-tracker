import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SETTINGS_KEY, writeSettings } from '../db/db';
import { defaultSettings } from '../db/defaults';
import type { Settings } from '../lib/types';
import { makeT, locale as localeFor, type T } from '../i18n';
import { dateKey, isValidTimeZone, DEFAULT_TZ } from '../lib/time';
import { useNow } from '../hooks/useNow';

interface AppCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  t: T;
  locale: string;
  tz: string;
  now: number;
  today: string;
  dark: boolean;
  fmtDate: (ms: number, opts?: Intl.DateTimeFormatOptions) => string;
  fmtTime: (ms: number) => string;
  fmtNum: (n: number, digits?: number) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const row = useLiveQuery(() => db.kv.get(SETTINGS_KEY).then((r) => r ?? null), []);
  const settings = useMemo<Settings>(() => ({ ...defaultSettings(), ...((row?.value as Partial<Settings>) ?? {}) }), [row]);
  const now = useNow(1000);
  const tz = isValidTimeZone(settings.timeZone) ? settings.timeZone : DEFAULT_TZ;
  const [systemDark, setSystemDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.lang = settings.lang;
    try {
      localStorage.setItem('form-theme', JSON.stringify(settings.theme));
    } catch {
      /* private mode */
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#050a08' : '#f2f6f4'));
  }, [dark, settings.lang, settings.theme]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    await writeSettings(db, patch, defaultSettings());
  }, []);

  const value = useMemo<AppCtx>(() => {
    const loc = localeFor(settings.lang);
    return {
      settings,
      update,
      t: makeT(settings.lang),
      locale: loc,
      tz,
      now,
      today: dateKey(now, tz),
      dark,
      fmtDate: (ms, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
        new Intl.DateTimeFormat(loc, { timeZone: tz, ...opts }).format(ms),
      fmtTime: (ms) => new Intl.DateTimeFormat(loc, { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms),
      fmtNum: (n, digits = 1) => new Intl.NumberFormat(loc, { maximumFractionDigits: digits }).format(n),
    };
  }, [settings, update, tz, now, dark]);

  if (row === undefined) return <div className="grid min-h-dvh place-items-center text-ink3" role="status">…</div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}
