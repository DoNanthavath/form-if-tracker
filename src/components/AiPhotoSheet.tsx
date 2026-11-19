import { useEffect, useRef, useState } from 'react';
import { Camera, ClipboardPaste, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { chatGptPrompt, chatGptUrl, parseChatGptReply } from '../lib/chatgpt';
import { Badge, Button, Segmented, Sheet, TextInput, cx } from './ui';
import { useApp } from '../app/context';
import { useAiConfig } from '../hooks/useDeviceConfig';
import { AiError, analyzeFoodPhoto, type FoodAnalysis } from '../lib/ai';
import { compressImage } from '../lib/photo';
import { MEAL_TYPES } from '../lib/nutrition';
import type { MealType } from '../lib/types';
import { timeKey, zonedInstant } from '../lib/time';
import { uid } from '../lib/id';
import { db } from '../db/db';
import { useToast } from './Toast';
import { defaultMealType } from './FoodSheet';
import type { TKey } from '../i18n';

type Row = FoodAnalysis['items'][number] & { selected: boolean };

export function AiPhotoSheet({ open, onClose, date, mode = 'claude' }: { open: boolean; onClose: () => void; date: string; mode?: 'claude' | 'chatgpt' }) {
  const { t, settings, tz } = useApp();
  const ai = useAiConfig();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ analyze: string; keep: string } | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState('');
  const [meal, setMeal] = useState<MealType>('lunch');
  const [reply, setReply] = useState('');
  const gpt = mode === 'chatgpt';

  useEffect(() => {
    if (!open) return;
    setPhoto(null); setHint(''); setErr(null); setRows(null); setNote(''); setReply('');
    setMeal(defaultMealType(timeKey(Date.now(), tz)));
  }, [open, tz]);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const [analyze, keep] = await Promise.all([compressImage(file, 1024, 0.8), compressImage(file, 720, 0.72)]);
      setPhoto({ analyze, keep });
      setRows(null);
      setErr(null);
    } catch {
      setErr(t('photoTooLarge'));
    }
  }

  async function analyze() {
    if (!photo || !ai.apiKey) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await analyzeFoodPhoto({ apiKey: ai.apiKey, model: ai.model, imageDataUrl: photo.analyze, hint, lang: settings.lang });
      setRows(res.items.map((i) => ({ ...i, selected: true })));
      setNote(res.note);
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'other';
      setErr(t(`aiErr_${code}` as TKey, { e: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!rows) return;
    const chosen = rows.filter((r) => r.selected && r.name.trim());
    if (!chosen.length) return;
    const n = Date.now();
    const time = timeKey(n, tz);
    const at = zonedInstant(date, time, tz);
    await db.foods.bulkAdd(
      chosen.map((r, i) => ({
        id: uid(), date, time, at, mealType: meal, name: r.name.trim().slice(0, 200), foodItemId: null, quantity: 1, unit: r.portion.slice(0, 100),
        kcal: Math.max(0, Math.round(r.kcal)), protein: Math.max(0, r.protein), carbs: Math.max(0, r.carbs), fat: Math.max(0, r.fat),
        photo: i === 0 && photo ? photo.keep : null, notes: `${gpt ? 'ChatGPT' : 'AI'} (${t(`aiConf_${r.confidence}`)})`, createdAt: n, updatedAt: n,
      })),
    );
    toast(t('aiSavedN', { n: chosen.length }));
    onClose();
  }

  async function openChatGpt() {
    const prompt = chatGptPrompt(settings.lang, hint);
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      /* the prompt is also prefilled through the link */
    }
    window.open(chatGptUrl(prompt), '_blank', 'noopener');
  }

  function applyReply(text: string) {
    setReply(text);
    const parsed = parseChatGptReply(text);
    if (!parsed) return setErr(t('gptParseErr'));
    setErr(null);
    setRows(parsed.items.map((i) => ({ ...i, selected: true })));
    setNote(parsed.note);
  }

  async function pasteReply() {
    try {
      applyReply(await navigator.clipboard.readText());
    } catch {
      setErr(t('gptPasteManual'));
    }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));
  const total = rows?.filter((r) => r.selected).reduce((a, r) => a + (Number.isFinite(r.kcal) ? r.kcal : 0), 0) ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={gpt ? t('gptTitle') : t('aiPhoto')}
      footer={
        rows ? (
          <Button className="w-full" onClick={save} disabled={!rows.some((r) => r.selected)}>{t('aiAddSelected')} · {Math.round(total)} kcal</Button>
        ) : !gpt && photo ? (
          <Button className="w-full" onClick={analyze} disabled={busy || !ai.apiKey}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {busy ? t('aiAnalyzing') : t('aiAnalyze')}
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4 py-1">
        {!gpt && (
          <>
        {!ai.apiKey && <div className="rounded-2xl bg-warn/15 p-3 text-[13px] text-warn" role="alert">{t('aiNeedKey')}</div>}
        {photo ? (
          <div className="flex items-center gap-3">
            <img src={photo.keep} alt="" className="h-24 w-24 rounded-2xl object-cover" />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}><Camera size={18} />{t('aiRetake')}</Button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="press flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-mint/40 bg-mintsoft px-4 py-10 text-mint">
            <Camera size={36} />
            <span className="text-[15px] font-semibold">{t('aiPhoto')}</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />

        {photo && !rows && <TextInput label={t('aiHint')} value={hint} maxLength={500} onChange={(e) => setHint(e.target.value)} />}
          </>
        )}
        {gpt && !rows && (
          <ol className="flex flex-col gap-4 text-[14px] leading-relaxed">
            <li className="flex gap-3">
              <StepNo n={1} />
              <div className="flex-1">
                <div>{t('gptStep1')}</div>
                <TextInput label={t('aiHint')} value={hint} maxLength={300} onChange={(e) => setHint(e.target.value)} />
                <Button className="mt-2 w-full" onClick={openChatGpt}><ExternalLink size={18} />{t('gptOpen')}</Button>
              </div>
            </li>
            <li className="flex gap-3"><StepNo n={2} /><div className="flex-1">{t('gptStep2')}</div></li>
            <li className="flex gap-3">
              <StepNo n={3} />
              <div className="flex-1">
                <div>{t('gptStep3')}</div>
                <Button variant="secondary" className="mt-2 w-full" onClick={pasteReply}><ClipboardPaste size={18} />{t('gptPaste')}</Button>
                <textarea className="field mt-2 min-h-[90px] !text-[13px]" placeholder={t('gptPasteManual')} value={reply} onChange={(e) => (e.target.value.includes('{') ? applyReply(e.target.value) : setReply(e.target.value))} aria-label={t('gptPaste')} />
              </div>
            </li>
          </ol>
        )}
        {err && <div role="alert" className="rounded-2xl bg-danger/10 p-3 text-[13px] text-danger">{err}</div>}

        {rows && (
          <>
            <div className="text-[13px] font-medium text-ink2">{t('aiResults')}</div>
            <Segmented label={t('mealType')} value={meal} onChange={setMeal} options={MEAL_TYPES.map((m) => ({ value: m, label: t(`meal_${m}`) }))} className="[&_button]:text-[12px]" />
            {rows.map((r, i) => (
              <div key={i} className={cx('rounded-2xl border p-3 transition-opacity', r.selected ? 'border-mint/40 bg-bg2' : 'border-line opacity-55')}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-[var(--mint)]" checked={r.selected} onChange={(e) => setRow(i, { selected: e.target.checked })} aria-label={r.name} />
                  <input className="field !min-h-[40px] flex-1 !py-1.5 font-semibold" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label={t('foodName')} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-ink3">
                  <input className="field !min-h-[36px] flex-1 !py-1 !text-[13px]" value={r.portion} onChange={(e) => setRow(i, { portion: e.target.value })} aria-label={t('servingSize')} />
                  <Badge tone={r.confidence === 'low' ? 'warn' : r.confidence === 'medium' ? 'muted' : 'mint'}>{t(`aiConf_${r.confidence}`)}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1 text-[11px] text-ink3">
                      {k === 'kcal' ? 'kcal' : `${t(k)} g`}
                      <input className="field num !min-h-[38px] !px-2 !py-1 !text-[15px]" inputMode="decimal" value={String(r[k])} onChange={(e) => setRow(i, { [k]: num(e.target.value) } as Partial<Row>)} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {note && <p className="text-[13px] leading-relaxed text-ink2">💡 {note}</p>}
          </>
        )}
        <p className="text-[11px] leading-relaxed text-ink3">{t('aiEstimateNote')} {gpt ? t('gptPrivacy') : t('aiPrivacy')}</p>
      </div>
    </Sheet>
  );
}

function StepNo({ n }: { n: number }) {
  return <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mintsoft text-[12px] font-bold text-mint">{n}</span>;
}
