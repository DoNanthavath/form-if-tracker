import { useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, ImageIcon, Plus, Save, Trash2, Utensils } from 'lucide-react';
import { useApp } from '../app/context';
import { useFoodsOn } from '../hooks/data';
import { Button, Card, Empty, IconButton, Sheet, TextInput } from '../components/ui';
import { MacroSummary } from '../components/MacroSummary';
import { FoodSheet } from '../components/FoodSheet';
import { LibraryManager } from '../components/LibraryManager';
import { MEAL_TYPES, formatQuantity, sumMacros } from '../lib/nutrition';
import { shiftDate, zonedInstant } from '../lib/time';
import type { FoodEntry, MealType } from '../lib/types';
import { deleteFood, restoreFood, saveMeal } from '../db/repo';
import { useToast } from '../components/Toast';
import { uid } from '../lib/id';
import { PageHeader } from '../components/PageHeader';

export function FoodPage() {
  const { t, today, tz, fmtDate } = useApp();
  const [date, setDate] = useState(today);
  const entries = useFoodsOn(date);
  const [sheet, setSheet] = useState<{ open: boolean; entry: FoodEntry | null }>({ open: false, entry: null });
  const [lib, setLib] = useState(false);
  const [mealSave, setMealSave] = useState<{ type: MealType; name: string } | null>(null);
  const toast = useToast();
  const totals = sumMacros(entries ?? []);
  const dateLabel = date === today ? t('today') : date === shiftDate(today, -1) ? t('yesterday') : fmtDate(zonedInstant(date, '12:00', tz), { weekday: 'short', day: 'numeric', month: 'short' });

  const remove = async (e: FoodEntry) => {
    const old = await deleteFood(e.id);
    if (old) toast(t('deleted'), { label: t('undo'), run: () => restoreFood(old) });
  };

  const doSaveMeal = async () => {
    if (!mealSave || !entries) return;
    const items = entries.filter((e) => e.mealType === mealSave.type);
    const name = mealSave.name.trim() || t(`meal_${mealSave.type}`);
    const n = Date.now();
    await saveMeal({ id: uid(), name, items: items.map((e) => ({ name: e.name, quantity: e.quantity, unit: e.unit, foodItemId: e.foodItemId, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat })), createdAt: n, updatedAt: n });
    toast(t('mealSaved'));
    setMealSave(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('foodJournal')}
        action={
          <IconButton label={t('manageLibrary')} onClick={() => setLib(true)}>
            <BookOpen size={20} />
          </IconButton>
        }
      />
      <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-1">
        <IconButton label="←" onClick={() => setDate(shiftDate(date, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <label className="relative flex-1 text-center">
          <span className="text-[15px] font-semibold">{dateLabel}</span>
          <input type="date" aria-label={t('date')} value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <IconButton label="→" disabled={date >= today} className="disabled:opacity-30" onClick={() => setDate(shiftDate(date, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <Card>
        <MacroSummary totals={totals} />
        <Button className="mt-5 w-full" onClick={() => setSheet({ open: true, entry: null })}>
          <Plus size={20} />
          {t('addFood')}
        </Button>
      </Card>

      {entries && entries.length === 0 && (
        <Card>
          <Empty icon={<Utensils size={20} />} title={t('noFoodsDay')} hint={t('noFoodsHint')} />
        </Card>
      )}

      {entries &&
        MEAL_TYPES.map((m) => {
          const list = entries.filter((e) => e.mealType === m);
          if (!list.length) return null;
          const sub = sumMacros(list);
          return (
            <Card key={m} className="!p-4">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">{t(`meal_${m}`)}</h3>
                <div className="flex items-center gap-1">
                  <span className="num text-[13px] text-ink2">
                    {sub.kcal} kcal · P {sub.protein} g
                  </span>
                  <IconButton label={t('saveAsMeal')} className="h-9 w-9" onClick={() => setMealSave({ type: m, name: '' })}>
                    <Save size={16} />
                  </IconButton>
                </div>
              </div>
              <ul className="divide-y divide-line">
                {list.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    {e.photo ? <img src={e.photo} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" /> : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card2 text-ink3" aria-hidden="true"><ImageIcon size={16} /></div>}
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSheet({ open: true, entry: e })} aria-label={`${t('edit')} ${e.name}`}>
                      <div className="truncate text-[15px] font-medium">{e.name}</div>
                      <div className="truncate text-[12px] text-ink3">
                        {e.time} · {formatQuantity(e.quantity)} × {e.unit || '1'} · P {e.protein} · C {e.carbs} · F {e.fat}
                      </div>
                    </button>
                    <div className="num text-[15px] font-semibold">{e.kcal}</div>
                    <button type="button" onClick={() => remove(e)} className="press grid h-10 w-9 place-items-center rounded-lg text-ink3 hover:text-danger" aria-label={`${t('delete')} ${e.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}


      <FoodSheet open={sheet.open} entry={sheet.entry} date={date} onClose={() => setSheet({ open: false, entry: null })} />
      <LibraryManager open={lib} onClose={() => setLib(false)} />
      <Sheet open={!!mealSave} onClose={() => setMealSave(null)} title={t('saveAsMeal')} footer={<Button className="w-full" onClick={doSaveMeal}>{t('save')}</Button>}>
        {mealSave && <TextInput label={t('mealName')} value={mealSave.name} placeholder={t(`meal_${mealSave.type}`)} onChange={(e) => setMealSave({ ...mealSave, name: e.target.value })} maxLength={200} />}
      </Sheet>
    </div>
  );
}
