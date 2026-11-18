import { useEffect, useState } from 'react';
import { Button, Sheet, TextInput } from './ui';
import { useApp } from '../app/context';
import { saveWeight } from '../db/repo';
import { db } from '../db/db';
import type { WeightEntry } from '../lib/types';
import { useConfirm } from './Confirm';
import { useToast } from './Toast';
import { useWeights } from '../hooks/data';
import { latest } from '../lib/weight';

export function WeightSheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: WeightEntry | null }) {
  const { t, today, settings } = useApp();
  const weights = useWeights() ?? [];
  const confirm = useConfirm();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [kg, setKg] = useState('');
  const [waist, setWaist] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErr({});
    setDate(entry?.date ?? today);
    setKg(entry ? String(entry.kg) : '');
    setWaist(entry?.waistCm != null ? String(entry.waistCm) : '');
    setNote(entry?.note ?? '');
  }, [open, entry, today]);

  const placeholder = String(latest(weights)?.kg ?? settings.startWeightKg);

  async function submit() {
    const e: Record<string, string> = {};
    const w = Number(kg.replace(',', '.'));
    if (!(w >= 20 && w <= 400)) e.kg = t('errRange', { a: 20, b: 400 });
    const wc = waist.trim() ? Number(waist.replace(',', '.')) : null;
    if (wc != null && !(wc >= 30 && wc <= 300)) e.waist = t('errRange', { a: 30, b: 300 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) e.date = t('errInvalidTime');
    setErr(e);
    if (Object.keys(e).length) return;
    const clash = await db.weights.where('date').equals(date).first();
    if (clash && clash.id !== entry?.id) {
      const ok = await confirm({ title: t('replaceWeightConfirm', { kg: clash.kg }), confirmLabel: t('save') });
      if (!ok) return;
    }
    await saveWeight({ id: entry?.id, date, kg: Math.round(w * 10) / 10, waistCm: wc, note: note.slice(0, 2000) });
    toast(t('saved'));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('weightLog')} footer={<Button className="w-full" onClick={submit}>{t('save')}</Button>}>
      <div className="flex flex-col gap-4 py-1">
        <TextInput label={t('weightKg')} inputMode="decimal" value={kg} placeholder={placeholder} onChange={(e) => setKg(e.target.value)} error={err.kg} autoFocus className="field num !text-[28px] !font-semibold" />
        <TextInput label={t('date')} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} error={err.date} />
        <TextInput label={`${t('waist')} (${t('optional')})`} inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} error={err.waist} />
        <TextInput label={`${t('notes')} (${t('optional')})`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        <p className="text-[12px] text-ink3">{t('noWeightsHint')}</p>
      </div>
    </Sheet>
  );
}
