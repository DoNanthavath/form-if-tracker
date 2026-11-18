import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, Search, Trash2, Utensils } from 'lucide-react';
import { Badge, Button, Empty, Field, Segmented, Sheet, TextInput, cx } from './ui';
import { useApp } from '../app/context';
import { useFoodItems, useMeals, useRecentFoods } from '../hooks/data';
import { MEAL_TYPES, PORTIONS, formatQuantity, kcalFromMacros, parseQuantity, scaleMacros } from '../lib/nutrition';
import type { FoodEntry, FoodItem, Macros, MealType, SavedMeal } from '../lib/types';
import { uid } from '../lib/id';
import { saveFood, saveFoodItem, deleteMeal } from '../db/repo';
import { useToast } from './Toast';
import { compressImage } from '../lib/photo';
import { timeKey, zonedInstant } from '../lib/time';
import { useConfirm } from './Confirm';
import { db } from '../db/db';

export function defaultMealType(hm: string): MealType {
  const h = Number(hm.slice(0, 2));
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  return 'dinner';
}

interface Draft {
  id: string | null;
  name: string;
  foodItemId: string | null;
  unit: string;
  mealType: MealType;
  quantity: string;
  per: { kcal: string; protein: string; carbs: string; fat: string };
  date: string;
  time: string;
  notes: string;
  photo: string | null;
  saveToLibrary: boolean;
  createdAt: number | null;
}

const str = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 10) / 10) : '');

export function FoodSheet({ open, onClose, date, entry }: { open: boolean; onClose: () => void; date: string; entry?: FoodEntry | null }) {
  const { t, settings, tz } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const items = useFoodItems();
  const recent = useRecentFoods(60);
  const meals = useMeals();
  const [step, setStep] = useState<'pick' | 'form'>('pick');
  const [tab, setTab] = useState<'library' | 'recent' | 'meals'>('library');
  const [q, setQ] = useState('');
  const [d, setD] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = settings.lang;

  const blank = (): Draft => {
    const time = timeKey(Date.now(), tz);
    return { id: null, name: '', foodItemId: null, unit: '', mealType: defaultMealType(time), quantity: '1', per: { kcal: '', protein: '', carbs: '', fat: '' }, date, time, notes: '', photo: null, saveToLibrary: false, createdAt: null };
  };

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setQ('');
    if (entry) {
      const qn = entry.quantity > 0 ? entry.quantity : 1;
      setD({
        id: entry.id, name: entry.name, foodItemId: entry.foodItemId, unit: entry.unit, mealType: entry.mealType, quantity: String(entry.quantity),
        per: { kcal: str(entry.kcal / qn), protein: str(entry.protein / qn), carbs: str(entry.carbs / qn), fat: str(entry.fat / qn) },
        date: entry.date, time: entry.time, notes: entry.notes, photo: entry.photo, saveToLibrary: false, createdAt: entry.createdAt,
      });
      setStep('form');
    } else {
      setD(blank());
      setStep('pick');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry, date]);

  const name = (f: FoodItem) => (lang === 'th' ? f.nameTh || f.nameEn : f.nameEn || f.nameTh);
  const serving = (f: FoodItem) => (lang === 'th' ? f.servingTh || f.servingEn : f.servingEn || f.servingTh);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = [...items].sort((a, b) => Number(a.builtin) - Number(b.builtin) || name(a).localeCompare(name(b)));
    return s ? list.filter((f) => `${f.nameTh} ${f.nameEn}`.toLowerCase().includes(s)) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, lang]);

  const recentUnique = useMemo(() => {
    const seen = new Set<string>();
    const s = q.trim().toLowerCase();
    return recent.filter((e) => {
      const k = `${e.name}|${e.quantity}|${e.kcal}`;
      if (seen.has(k) || (s && !e.name.toLowerCase().includes(s))) return false;
      seen.add(k);
      return true;
    }).slice(0, 25);
  }, [recent, q]);

  const pickItem = (f: FoodItem) => {
    const base = blank();
    setD({ ...base, name: name(f), foodItemId: f.id, unit: serving(f), mealType: f.category === 'drink' ? 'drink' : base.mealType, per: { kcal: str(f.kcal), protein: str(f.protein), carbs: str(f.carbs), fat: str(f.fat) } });
    setStep('form');
  };
  const pickRecent = (e: FoodEntry) => {
    const base = blank();
    const qn = e.quantity > 0 ? e.quantity : 1;
    setD({ ...base, name: e.name, foodItemId: e.foodItemId, unit: e.unit, quantity: String(e.quantity), mealType: e.mealType === 'drink' ? 'drink' : base.mealType, per: { kcal: str(e.kcal / qn), protein: str(e.protein / qn), carbs: str(e.carbs / qn), fat: str(e.fat / qn) } });
    setStep('form');
  };
  const addMeal = async (m: SavedMeal) => {
    const time = timeKey(Date.now(), tz);
    const mealType = defaultMealType(time);
    const at = zonedInstant(date, time, tz);
    const n = Date.now();
    await db.foods.bulkAdd(m.items.map((it) => ({ id: uid(), date, time, at, mealType, name: it.name, foodItemId: it.foodItemId, quantity: it.quantity, unit: it.unit, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, photo: null, notes: m.name, createdAt: n, updatedAt: n })));
    toast(t('saved'));
    onClose();
  };

  const qty = d ? parseQuantity(d.quantity) : null;
  const perNum: Macros | null = d
    ? { kcal: Number(d.per.kcal || 0), protein: Number(d.per.protein || 0), carbs: Number(d.per.carbs || 0), fat: Number(d.per.fat || 0) }
    : null;
  const total = perNum && qty != null ? scaleMacros(perNum, qty) : null;

  async function submit() {
    if (!d || !perNum) return;
    const e: Record<string, string> = {};
    if (!d.name.trim()) e.name = t('errName');
    if (qty == null || qty <= 0 || qty > 100) e.quantity = t('errNumber');
    for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
      const v = d.per[k];
      if (k === 'kcal' && v === '') e.kcal = t('errNumber');
      else if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > (k === 'kcal' ? 10000 : 1000))) e[k] = t('errNumber');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = t('errInvalidTime');
    if (!/^\d{2}:\d{2}$/.test(d.time)) e.time = t('errInvalidTime');
    setErrors(e);
    if (Object.keys(e).length) return;
    const totals = scaleMacros(perNum, qty!);
    const n = Date.now();
    let foodItemId = d.foodItemId;
    if (d.saveToLibrary && !foodItemId) {
      foodItemId = uid();
      await saveFoodItem({ id: foodItemId, nameTh: lang === 'th' ? d.name.trim() : '', nameEn: lang === 'en' ? d.name.trim() : '', servingTh: d.unit, servingEn: d.unit, category: 'custom', builtin: false, updatedAt: n, ...perNum });
    }
    await saveFood({
      id: d.id ?? uid(), date: d.date, time: d.time, at: zonedInstant(d.date, d.time, tz), mealType: d.mealType, name: d.name.trim().slice(0, 200),
      foodItemId, quantity: qty!, unit: d.unit.slice(0, 100), ...totals, photo: d.photo, notes: d.notes.slice(0, 2000), createdAt: d.createdAt ?? n, updatedAt: n,
    });
    toast(t('saved'));
    onClose();
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !d) return;
    try {
      const url = await compressImage(file);
      setD({ ...d, photo: url });
    } catch {
      toast(t('photoTooLarge'));
    }
  }

  const set = (patch: Partial<Draft>) => d && setD({ ...d, ...patch });
  const setPer = (k: keyof Draft['per'], v: string) => d && setD({ ...d, per: { ...d.per, [k]: v } });

  const Row = ({ title, sub, kcal, onClick, badge }: { title: string; sub: string; kcal: number; onClick: () => void; badge?: string }) => (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-card2">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        <div className="truncate text-[12px] text-ink3">
          {sub} {badge && <span className="ml-1 text-ink3">· {badge}</span>}
        </div>
      </div>
      <div className="num shrink-0 text-[14px] font-semibold text-ink2">{kcal}</div>
      <ChevronRight size={16} className="shrink-0 text-ink3" aria-hidden="true" />
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? t('editFood') : t('addFood')}
      footer={
        step === 'form' ? (
          <div className="flex gap-3">
            {!entry && (
              <Button variant="secondary" onClick={() => setStep('pick')}>
                {t('back')}
              </Button>
            )}
            <Button className="flex-1" onClick={submit}>
              {t('save')}
              {total && <span className="num opacity-80">· {total.kcal} kcal</span>}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => { setD(blank()); setStep('form'); }}>
            {t('custom')}
          </Button>
        )
      }
    >
      {step === 'pick' && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink3" aria-hidden="true" />
            <input className="field pl-10" placeholder={t('searchFoods')} aria-label={t('searchFoods')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented label={t('library')} value={tab} onChange={setTab} options={[{ value: 'library', label: t('library') }, { value: 'recent', label: t('recent') }, { value: 'meals', label: t('savedMeals') }]} />
          <div className="min-h-[300px]">
            {tab === 'library' &&
              (filtered.length ? filtered.map((f) => <Row key={f.id} title={name(f)} sub={serving(f)} kcal={f.kcal} onClick={() => pickItem(f)} badge={f.builtin ? undefined : t('custom')} />) : <Empty title={t('noResults')} />)}
            {tab === 'recent' &&
              (recentUnique.length ? recentUnique.map((e) => <Row key={e.id} title={e.name} sub={`${formatQuantity(e.quantity)} × ${e.unit || '1'}`} kcal={e.kcal} onClick={() => pickRecent(e)} />) : <Empty title={t('noResults')} />)}
            {tab === 'meals' &&
              (meals.length ? (
                meals.map((m) => (
                  <div key={m.id} className="flex items-center gap-1">
                    <div className="flex-1">
                      <Row title={m.name} sub={t('items', { n: m.items.length })} kcal={m.items.reduce((a, b) => a + b.kcal, 0)} onClick={() => addMeal(m)} />
                    </div>
                    <button
                      type="button"
                      aria-label={`${t('delete')} ${m.name}`}
                      className="press grid h-10 w-10 place-items-center rounded-full text-ink3 hover:text-danger"
                      onClick={async () => (await confirm({ title: `${t('delete')} “${m.name}”?`, danger: true, confirmLabel: t('delete') })) && deleteMeal(m.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <Empty icon={<Utensils size={20} />} title={t('noResults')} hint={t('saveAsMeal')} />
              ))}
          </div>
          <p className="text-[11px] leading-relaxed text-ink3">{t('estimateNote')}</p>
        </div>
      )}

      {step === 'form' && d && (
        <div className="flex flex-col gap-4 pt-1">
          <TextInput label={t('foodName')} value={d.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} maxLength={200} autoComplete="off" />
          <Segmented label={t('mealType')} value={d.mealType} onChange={(v) => set({ mealType: v })} options={MEAL_TYPES.map((m) => ({ value: m, label: t(`meal_${m}`) }))} className="[&_button]:text-[12px]" />
          <Field label={`${t('portion')}${d.unit ? ` — 1 = ${d.unit}` : ''}`} error={errors.quantity}>
            {(id, desc) => (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2" role="group" aria-label={t('portion')}>
                  {PORTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={qty === p}
                      onClick={() => set({ quantity: String(p) })}
                      className={cx('press num min-h-[40px] min-w-[52px] rounded-xl border px-3 text-[15px] font-semibold', qty === p ? 'border-mint bg-mintsoft text-mint' : 'border-line bg-bg2 text-ink2')}
                    >
                      {formatQuantity(p)}
                    </button>
                  ))}
                </div>
                <input id={id} aria-describedby={desc} className="field" inputMode="decimal" value={d.quantity} onChange={(e) => set({ quantity: e.target.value })} placeholder="1, 1/2, 0.75" aria-invalid={!!errors.quantity} />
              </div>
            )}
          </Field>
          {!d.foodItemId && <TextInput label={t('servingSize')} value={d.unit} onChange={(e) => set({ unit: e.target.value })} maxLength={100} placeholder={lang === 'th' ? '1 จาน' : '1 plate'} />}
          <div>
            <div className="mb-2 text-[13px] font-medium text-ink2">{t('perServing')}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <TextInput key={k} label={k === 'kcal' ? 'kcal' : `${t(k)} (g)`} inputMode="decimal" value={d.per[k]} onChange={(e) => setPer(k, e.target.value)} error={errors[k]} />
              ))}
            </div>
            {perNum && (perNum.protein + perNum.carbs + perNum.fat > 0) && (
              <div className="mt-1.5 text-[11px] text-ink3">{t('macrosHint', { n: kcalFromMacros(perNum) })}</div>
            )}
          </div>
          {total && (
            <div className="rounded-2xl border border-mint/25 bg-mintsoft p-3.5">
              <div className="text-[12px] text-ink2">{t('totalForPortion')}</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="num text-[24px] font-semibold text-mint">{total.kcal} <span className="text-[13px]">kcal</span></span>
                <span className="text-[13px] text-protein">P {total.protein}g</span>
                <span className="text-[13px] text-carbs">C {total.carbs}g</span>
                <span className="text-[13px] text-fat">F {total.fat}g</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextInput label={t('date')} type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} error={errors.date} />
            <TextInput label={t('time')} type="time" value={d.time} onChange={(e) => set({ time: e.target.value })} error={errors.time} />
          </div>
          <Field label={`${t('notes')} (${t('optional')})`}>
            {(id) => <textarea id={id} className="field min-h-[72px]" value={d.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />}
          </Field>
          <div>
            <div className="mb-2 text-[13px] font-medium text-ink2">{t('photo')} ({t('optional')})</div>
            {d.photo ? (
              <div className="flex items-center gap-3">
                <img src={d.photo} alt={d.name} className="h-20 w-20 rounded-2xl object-cover" />
                <Button variant="danger" onClick={() => set({ photo: null })}>
                  <Trash2 size={16} /> {t('removePhoto')}
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Camera size={18} /> {t('addPhoto')}
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {!d.foodItemId && !d.id && (
            <label className="flex min-h-[44px] items-center gap-3 text-[14px] text-ink2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--mint)]" checked={d.saveToLibrary} onChange={(e) => set({ saveToLibrary: e.target.checked })} />
              {t('saveToLibrary')}
            </label>
          )}
          {d.foodItemId && <div><Badge tone="muted">{t('estimateNote')}</Badge></div>}
        </div>
      )}
    </Sheet>
  );
}
