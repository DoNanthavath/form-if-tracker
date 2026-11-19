import { z } from 'zod';
import { cleanAnalysis, type FoodAnalysis } from './ai';
import type { Lang } from './types';

/**
 * "Use my ChatGPT" flow: FORM prepares a prompt, the user attaches their photo in
 * the ChatGPT app (their own subscription), then pastes the answer back here.
 * Nothing is sent from FORM; we only parse the pasted text.
 */
export function chatGptPrompt(lang: Lang, hint = ''): string {
  const language = lang === 'th' ? 'Thai' : 'English';
  return [
    'Estimate the nutrition of the food in the photo I attached.',
    'Identify each separate food or drink and estimate the portion that is actually visible.',
    'Use realistic Lao/Thai home and street-food preparation (include cooking oil, sugar in drinks, sauces).',
    hint.trim() ? `Extra info: ${hint.trim().slice(0, 300)}` : '',
    `Write "name", "portion" and "note" in ${language}. kcal in kcal; protein, carbs, fat in grams.`,
    'Reply ONLY with this JSON in a code block, nothing else:',
    '{"items":[{"name":"","portion":"","kcal":0,"protein":0,"carbs":0,"fat":0,"confidence":"high|medium|low"}],"note":""}',
  ].filter(Boolean).join('\n');
}

export function chatGptUrl(prompt: string): string {
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
}

const num = z.preprocess((v) => (typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : v), z.number().catch(0));
const Relaxed = z.object({
  items: z.array(z.object({
    name: z.coerce.string(),
    portion: z.coerce.string().catch(''),
    kcal: num, protein: num, carbs: num, fat: num,
    confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
  }).passthrough()),
  note: z.coerce.string().catch(''),
}).passthrough();

/** Extract and validate the JSON object from ChatGPT's reply (code fences, smart quotes, extra text). */
export function parseChatGptReply(text: string): FoodAnalysis | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const raw = fenced.slice(start, end + 1).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const res = Relaxed.safeParse(data);
  if (!res.success) return null;
  const out = cleanAnalysis({ is_food: true, note: res.data.note, items: res.data.items.map(({ name, portion, kcal, protein, carbs, fat, confidence }) => ({ name, portion, kcal, protein, carbs, fat, confidence })) });
  return out.items.length ? out : null;
}
