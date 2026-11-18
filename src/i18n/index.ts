import { th } from './th';
import { en } from './en';
import type { Lang } from '../lib/types';

export type TKey = keyof typeof th;
export type T = (key: TKey, vars?: Record<string, string | number>) => string;

const dicts: Record<Lang, Record<TKey, string>> = { th, en };

export function makeT(lang: Lang): T {
  const d = dicts[lang] ?? th;
  return (key, vars) => {
    let s = d[key] ?? th[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

export function locale(lang: Lang): string {
  return lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB';
}
