import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Sheet, TextInput } from './ui';
import { useApp } from '../app/context';
import { useFoodItems } from '../hooks/data';
import type { FoodItem } from '../lib/types';
import { deleteFoodItem, saveFoodItem } from '../db/repo';
import { uid } from '../lib/id';
import { useConfirm } from './Confirm';
import { useToast } from './Toast';

type Draft = { [K in 'nameTh' | 'nameEn' | 'servingTh' | 'servingEn' | 'kcal' | 'protein' | 'carbs' | 'fat']: string };

export function LibraryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, settings } = useApp();
  const items = useFoodItems();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<FoodItem | 'new' | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const name = (f: FoodItem) => (settings.lang === 'th' ? f.nameTh || f.nameEn : f.nameEn || f.nameTh);

  const startEdit = (f: FoodItem | 'new') => {
    setErr(null);
    setEditing(f);
    setD(
      f === 'new'
        ? { nameTh: '', nameEn: '', servingTh: '', servingEn: '', kcal: '', protein: '', carbs: '', fat: '' }
        : { nameTh: f.nameTh, nameEn: f.nameEn, servingTh: f.servingTh, servingEn: f.servingEn, kcal: String(f.kcal), protein: String(f.protein), carbs: String(f.carbs), fat: String(f.fat) },
    );
  };

  async function save() {
    if (!d || !editing) return;
    if (!d.nameTh.trim() && !d.nameEn.trim()) return setErr(t('errName'));
    const nums = (['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => Number(d[k] || 0));
    if (nums.some((n) => !Number.isFinite(n) || n < 0) || d.kcal === '') return setErr(t('errNumber'));
    const base = editing === 'new' ? { id: uid(), builtin: false, category: 'custom' as const } : editing;
    await saveFoodItem({ ...base, nameTh: d.nameTh.trim(), nameEn: d.nameEn.trim(), servingTh: d.servingTh.trim(), servingEn: d.servingEn.trim(), kcal: nums[0], protein: nums[1], carbs: nums[2], fat: nums[3], updatedAt: Date.now() });
    toast(t('saved'));
    setEditing(null);
  }

  const sorted = [...items].sort((a, b) => name(a).localeCompare(name(b)));
  return (
    <>
      <Sheet open={open && !editing} onClose={onClose} title={t('manageLibrary')} footer={<Button className="w-full" onClick={() => startEdit('new')}><Plus size={18} />{t('newFoodItem')}</Button>}>
        <p className="pb-2 text-[12px] text-ink3">{t('estimateNote')}</p>
        <ul className="divide-y divide-line">
          {sorted.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{name(f)}</div>
                <div className="truncate text-[12px] text-ink3">
                  {settings.lang === 'th' ? f.servingTh : f.servingEn} · {f.kcal} kcal · P {f.protein} g {f.builtin && <Badge tone="muted">{t('builtin')}</Badge>}
                </div>
              </div>
              <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink2 hover:bg-card2" aria-label={`${t('edit')} ${name(f)}`} onClick={() => startEdit(f)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink3 hover:text-danger" aria-label={`${t('delete')} ${name(f)}`} onClick={async () => (await confirm({ title: t('deleteItemConfirm'), danger: true, confirmLabel: t('delete') })) && deleteFoodItem(f.id)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={open && !!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('newFoodItem') : t('editFoodItem')} footer={<Button className="w-full" onClick={save}>{t('save')}</Button>}>
        {d && (
          <div className="flex flex-col gap-3 py-1">
            <TextInput label={t('nameTh')} value={d.nameTh} onChange={(e) => setD({ ...d, nameTh: e.target.value })} maxLength={200} />
            <TextInput label={t('nameEn')} value={d.nameEn} onChange={(e) => setD({ ...d, nameEn: e.target.value })} maxLength={200} />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label={t('servingTh')} value={d.servingTh} onChange={(e) => setD({ ...d, servingTh: e.target.value })} maxLength={100} />
              <TextInput label={t('servingEn')} value={d.servingEn} onChange={(e) => setD({ ...d, servingEn: e.target.value })} maxLength={100} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <TextInput key={k} label={k === 'kcal' ? 'kcal' : `${t(k)} (g)`} inputMode="decimal" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
              ))}
            </div>
            {err && <div role="alert" className="text-[13px] text-danger">{err}</div>}
          </div>
        )}
      </Sheet>
    </>
  );
}
