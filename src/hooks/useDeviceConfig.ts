import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { EMPTY_SYNC, SYNC_KEY, type SyncConfig } from '../sync/sheets';
import { DEFAULT_AI_MODEL, type AiModelId } from '../lib/ai';

export interface AiConfig { apiKey: string; model: AiModelId }
export const AI_KEY = 'ai';
const EMPTY_AI: AiConfig = { apiKey: '', model: DEFAULT_AI_MODEL };

export function useSyncConfig(): SyncConfig {
  const row = useLiveQuery(() => db.kv.get(SYNC_KEY), []);
  return { ...EMPTY_SYNC, ...((row?.value as Partial<SyncConfig>) ?? {}) };
}

export function useAiConfig(): AiConfig {
  const row = useLiveQuery(() => db.kv.get(AI_KEY), []);
  return { ...EMPTY_AI, ...((row?.value as Partial<AiConfig>) ?? {}) };
}

export async function writeAi(patch: Partial<AiConfig>) {
  const cur = ((await db.kv.get(AI_KEY))?.value as Partial<AiConfig>) ?? {};
  await db.kv.put({ key: AI_KEY, value: { ...EMPTY_AI, ...cur, ...patch } });
}
