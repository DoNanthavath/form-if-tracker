import { useEffect, useState } from 'react';
import { Button, Select, Sheet, TextInput } from './ui';
import { useApp } from '../app/context';
import type { ActivityEntry, ActivityType } from '../lib/types';
import { saveActivity } from '../db/repo';
import { uid } from '../lib/id';
import { timeKey, zonedInstant } from '../lib/time';
import { useToast } from './Toast';

export const ACTIVITY_TYPES: ActivityType[] = ['walk', 'run', 'cycling', 'strength', 'yoga', 'sport', 'steps', 'other'];

export function ActivitySheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: ActivityEntry | null }) {
  const { t, today, tz } = useApp();
  const toast = useToast();
  const [type, setType] = useState<ActivityType>('walk');
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState('');
  const [steps, setSteps] = useState('');
  const [kcal, setKcal] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setType(entry?.type ?? 'walk');
    setDate(entry?.date ?? today);
    setMinutes(entry?.minutes != null ? String(entry.minutes) : '');
    setSteps(entry?.steps != null ? String(entry.steps) : '');
    setKcal(entry?.kcal != null ? String(entry.kcal) : '');
    setNote(entry?.note ?? '');
  }, [open, entry, today]);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  async function submit() {
    const m = num(minutes);
    const st = num(steps);
    const k = num(kcal);
    if ([m, st, k].some((v) => v != null && (!Number.isFinite(v) || v < 0))) return setErr(t('errNumber'));
    if (m != null && m > 1440) return setErr(t('errRange', { a: 0, b: 1440 }));
    if (m == null && st == null) return setErr(t('errNumber'));
    if (date > today) return setErr(t('errInvalidTime'));
    const n = Date.now();
    await saveActivity({
      id: entry?.id ?? uid(), date, at: entry?.at ?? (date === today ? n : zonedInstant(date, timeKey(n, tz), tz)), type,
      minutes: m, steps: st != null ? Math.round(st) : null, kcal: k, note: note.slice(0, 2000), createdAt: entry?.createdAt ?? n, updatedAt: n,
    });
    toast(t('saved'));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('logActivity')} footer={<Button className="w-full" onClick={submit}>{t('save')}</Button>}>
      <div className="flex flex-col gap-4 py-1">
        <Select label={t('activityType')} value={type} onChange={setType} options={ACTIVITY_TYPES.map((a) => ({ value: a, label: t(`act_${a}`) }))} />
        <TextInput label={t('date')} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label={t('duration')} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <TextInput label={t('stepCount')} inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
        <TextInput label={`${t('kcalBurned')} (${t('optional')})`} inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        <TextInput label={`${t('notes')} (${t('optional')})`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        {err && <div role="alert" className="text-[13px] text-danger">{err}</div>}
        <p className="text-[12px] leading-relaxed text-ink3">{t('healthNote')}</p>
      </div>
    </Sheet>
  );
}
