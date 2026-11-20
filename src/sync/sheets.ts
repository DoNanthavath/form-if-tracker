import { db } from '../db/db';
import { buildPayload } from './payload';
import { DEFAULT_TZ, isValidTimeZone } from '../lib/time';
import type { Settings } from '../lib/types';
import { SETTINGS_KEY } from '../db/db';
import { newToken } from './appsScript';
import { applyHealthRows, normalizeHealthRows } from './health';

export const SYNC_KEY = 'sync';

export interface SyncConfig {
  enabled: boolean;
  url: string;
  token: string;
  lastSyncAt: number | null;
  lastError: string | null;
  sheetUrl: string | null;
  healthKey: string;
  healthLastPull: number | null;
  healthError: string | null;
  scriptVersion: number | null;
}

export const EMPTY_SYNC: SyncConfig = { enabled: false, url: '', token: '', lastSyncAt: null, lastError: null, sheetUrl: null, healthKey: '', healthLastPull: null, healthError: null, scriptVersion: null };

export async function readSync(): Promise<SyncConfig> {
  const row = await db.kv.get(SYNC_KEY);
  return { ...EMPTY_SYNC, ...((row?.value as Partial<SyncConfig>) ?? {}) };
}

export async function writeSync(patch: Partial<SyncConfig>): Promise<SyncConfig> {
  const next = { ...(await readSync()), ...patch };
  await db.kv.put({ key: SYNC_KEY, value: next });
  return next;
}

export function isAppsScriptUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.trim());
}

/** Push a full snapshot of all records (photos excluded) to the user's Apps Script. */
export async function syncNow(opts: { allowEmpty?: boolean } = {}): Promise<SyncConfig> {
  const cfg = await readSync();
  if (!cfg.url || !cfg.token) throw new Error('not-configured');
  const settings = ((await db.kv.get(SETTINGS_KEY))?.value as Partial<Settings>) ?? {};
  const tz = settings.timeZone && isValidTimeZone(settings.timeZone) ? settings.timeZone : DEFAULT_TZ;
  const [fasts, foods, weights, water, activities] = await Promise.all([db.fasts.toArray(), db.foods.toArray(), db.weights.toArray(), db.water.toArray(), db.activities.toArray()]);
  // Never wipe a filled spreadsheet with an empty app (e.g. after the app was reinstalled).
  if (!opts.allowEmpty && fasts.length + foods.length + weights.length + water.length + activities.length === 0) {
    await writeSync({ lastError: 'empty-local' });
    throw new Error('empty-local');
  }
  const payload = buildPayload(cfg.token, tz, { fasts, foods, weights, water, activities });
  try {
    // text/plain keeps this a "simple" CORS request (no preflight), which Apps Script requires.
    const healthKey = cfg.healthKey || newToken().slice(0, 32);
    if (!cfg.healthKey) await writeSync({ healthKey });
    const res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ ...payload, healthKey, tz }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; sheetUrl?: string; version?: number } | null;
    if (!res.ok || !json?.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
    dirty = false;
    saveDirty();
    return writeSync({ lastSyncAt: Date.now(), lastError: null, scriptVersion: json.version ?? 2, ...(json.sheetUrl?.startsWith('https://docs.google.com/') ? { sheetUrl: json.sheetUrl } : {}) });
  } catch (e) {
    await writeSync({ lastError: (e as Error).message || 'network' });
    throw e;
  }
}

/** Fetch Apple Health rows (relayed by the iPhone Shortcut) from the user's script and apply them. */
export async function pullHealth(): Promise<{ activities: number; weights: number }> {
  const cfg = await readSync();
  if (!cfg.enabled || !cfg.url || !cfg.token) throw new Error('not-configured');
  // The pull also (re)registers the health key and time zone with the script,
  // so the Shortcut works right after the script is updated, even before any sync.
  const healthKey = cfg.healthKey || newToken().slice(0, 32);
  if (!cfg.healthKey) await writeSync({ healthKey });
  const settings = ((await db.kv.get(SETTINGS_KEY))?.value as Partial<Settings>) ?? {};
  const tz = settings.timeZone && isValidTimeZone(settings.timeZone) ? settings.timeZone : DEFAULT_TZ;
  try {
    const res = await fetch(cfg.url, { method: 'POST', body: JSON.stringify({ token: cfg.token, action: 'health_pull', healthKey, tz }), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow' });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; rows?: unknown; version?: number } | null;
    // A v2 script doesn't know health_pull and answers with an error.
    if (!json?.ok || !Array.isArray(json.rows)) throw new Error(json?.ok === false && json.error === 'unauthorized' ? 'unauthorized' : 'script-outdated');
    const result = await applyHealthRows(normalizeHealthRows(json.rows));
    await writeSync({ healthLastPull: Date.now(), healthError: null, scriptVersion: json.version ?? 3 });
    return result;
  } catch (e) {
    await writeSync({ healthError: (e as Error).message || 'network' });
    throw e;
  }
}

let lastPull = 0;
async function maybePullHealth() {
  if (!navigator.onLine || Date.now() - lastPull < 5 * 60_000) return;
  const cfg = await readSync();
  if (!cfg.enabled || !cfg.url || !cfg.healthKey || cfg.healthError === 'script-outdated') return;
  lastPull = Date.now();
  await pullHealth().catch(() => {});
}

/* ───────── automatic sync after changes (debounced, offline-tolerant) ───────── */

const DIRTY_KEY = 'form-sync-dirty';
let dirty = (() => {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1';
  } catch {
    return false;
  }
})();
let timer: number | undefined;
let running = false;

function saveDirty() {
  try {
    localStorage.setItem(DIRTY_KEY, dirty ? '1' : '0');
  } catch {
    /* ignore */
  }
}

async function attempt() {
  if (!dirty || running || !navigator.onLine) return;
  const cfg = await readSync();
  if (!cfg.enabled || !cfg.url) return;
  running = true;
  try {
    await syncNow();
  } catch {
    /* error is recorded in config and shown in Settings; retried on next change / when back online */
  } finally {
    running = false;
  }
}

function schedule(delay = 4000) {
  window.clearTimeout(timer);
  timer = window.setTimeout(attempt, delay);
}

export function markDirty() {
  dirty = true;
  saveDirty();
  schedule();
}

let installed = false;
export function installAutoSync() {
  if (installed) return;
  installed = true;
  for (const table of [db.fasts, db.foods, db.weights, db.water, db.activities]) {
    table.hook('creating', () => void markDirty());
    table.hook('updating', () => void markDirty());
    table.hook('deleting', () => void markDirty());
  }
  window.addEventListener('online', () => schedule(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    schedule(1500);
    void maybePullHealth();
  });
  schedule(2000);
  window.setTimeout(() => void maybePullHealth(), 3000);
}
