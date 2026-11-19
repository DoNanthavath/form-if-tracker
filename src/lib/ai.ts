import { z } from 'zod';
import type { Lang } from './types';

/**
 * Food photo analysis with Claude, called directly from the browser using the
 * user's own API key (stored only on this device). The SDK is loaded lazily so
 * it never weighs down the app unless the feature is used.
 */

export const AI_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: '≈ $0.02 / photo' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: '≈ $0.001 / photo' },
] as const;
export type AiModelId = (typeof AI_MODELS)[number]['id'];
export const DEFAULT_AI_MODEL: AiModelId = 'claude-opus-5-5';

export const FoodItemSchema = z.object({
  name: z.string().describe('Short dish name in the requested language'),
  portion: z.string().describe('Visible portion, e.g. "1 bowl (~450 g)" or "1/2 plate"'),
  kcal: z.number().describe('Estimated energy for the visible portion, kcal'),
  protein: z.number().describe('Estimated protein, grams'),
  carbs: z.number().describe('Estimated carbohydrates, grams'),
  fat: z.number().describe('Estimated fat, grams'),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const AnalysisSchema = z.object({
  is_food: z.boolean().describe('false if the photo does not show food or drink'),
  items: z.array(FoodItemSchema),
  note: z.string().describe('One short sentence: main uncertainty or tip (e.g. hidden oil, sauce, portion size). Empty if none.'),
});
export type FoodAnalysis = z.infer<typeof AnalysisSchema>;

const SYSTEM = `You estimate the nutrition of meals from photos for a personal food diary used in Laos and Thailand.
Identify each distinct food or drink that is visible and estimate the portion that is actually shown (not a standard serving).
Consider typical Lao and Thai home and street-food preparation, including cooking oil, sugar in drinks, and sauces.
Give realistic middle estimates, not ranges. Do not invent brand names or label data.
Set confidence to low when the dish or portion is hard to judge.`;

export class AiError extends Error {
  constructor(public code: 'auth' | 'rate' | 'network' | 'refusal' | 'notfood' | 'invalid' | 'other', message: string) {
    super(message);
  }
}

/** Sanity-clamp model numbers before they reach the diary. */
export function cleanAnalysis(a: FoodAnalysis): FoodAnalysis {
  const n = (v: number, max: number) => (Number.isFinite(v) ? Math.min(Math.max(0, Math.round(v * 10) / 10), max) : 0);
  return {
    ...a,
    items: a.items
      .filter((i) => i.name.trim())
      .slice(0, 12)
      .map((i) => ({ ...i, name: i.name.trim().slice(0, 200), portion: i.portion.trim().slice(0, 100), kcal: Math.round(n(i.kcal, 5000)), protein: n(i.protein, 500), carbs: n(i.carbs, 800), fat: n(i.fat, 500) })),
  };
}

export async function analyzeFoodPhoto(opts: { apiKey: string; model: AiModelId; imageDataUrl: string; hint: string; lang: Lang }): Promise<FoodAnalysis> {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(opts.imageDataUrl);
  if (!match) throw new AiError('invalid', 'Unsupported image');
  const [{ default: Anthropic }, { betaZodOutputFormat }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/beta/zod'),
  ]);
  // The key belongs to the user and never leaves their device except to api.anthropic.com.
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const language = opts.lang === 'th' ? 'Thai' : 'English';
  const hint = opts.hint.trim().slice(0, 500);
  try {
    const response = await client.beta.messages.parse({
      model: opts.model,
      max_tokens: 4000,
      ...(opts.model === 'claude-opus-5-5'
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const, output_config: { format: betaZodOutputFormat(AnalysisSchema) } }
        : { output_config: { format: betaZodOutputFormat(AnalysisSchema) } }),
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: match[1] as 'image/jpeg', data: match[2] } },
            { type: 'text', text: `Write dish names, portions and the note in ${language}.${hint ? `\nThe person adds: ${hint}` : ''}` },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal') throw new AiError('refusal', 'The model declined this photo');
    const parsed = response.parsed_output;
    if (!parsed) throw new AiError('invalid', 'Could not read the analysis');
    if (!parsed.is_food || parsed.items.length === 0) throw new AiError('notfood', 'No food detected');
    return cleanAnalysis(parsed);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError('auth', e.message);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('rate', e.message);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('network', e.message);
    if (e instanceof Anthropic.APIError) throw new AiError('other', `${e.status ?? ''} ${e.message}`);
    throw new AiError('other', (e as Error).message);
  }
}
