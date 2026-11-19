import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Badge, Button, Sheet, TextInput, cx } from './ui';
import { useApp } from '../app/context';
import type { FastSession } from '../lib/types';
import { endTimeSuggestions, fastedMs, targetMs, validateSessionTimes } from '../lib/fasting';
import { endSession } from '../lib/fasting';
import { fromInputValue, toInputValue } from '../lib/datetimeInput';
import { formatDuration } from '../lib/time';
import { db } from '../db/db';
import { endFast } from '../db/repo';
import { useToast } from './Toast';
import type { TKey } from '../i18n';

export function EndFastSheet({ open, onClose, session }: { open: boolean; onClose: () => void; session: FastSession }) {
  const { t, tz, settings, fmtDate, fmtTime } = useApp();
  const toast = useToast();
  const now = Date.now();
  const foodTimes = useLiveQuery(() => db.foods.where('at').above(session.startAt).toArray().then((l) => l.map((f) => f.at)), [session.startAt]) ?? [];
  const sugg = useMemo(() => endTimeSuggestions(session, now, settings, tz, foodTimes), [session, now, settings, tz, foodTimes]);
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    // Long overtime → most likely already eating; suggest the planned eating start.
    const overtime = fastedMs(session, Date.now()) - targetMs(session) > 60 * 60 * 1000;
    setValue(toInputValue(overtime && sugg.planned ? sugg.planned : Date.now(), tz));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const endAt = fromInputValue(value, tz);
  const preview = Number.isFinite(endAt) ? endSession(session, endAt, Date.now()) : null;
  const fasted = preview ? fastedMs(preview, preview.endAt!) : 0;
  const ok = fasted >= targetMs(session);
  const label = (ms: number) => `${fmtDate(ms, { weekday: 'short', day: 'numeric' })} ${fmtTime(ms)}`;

  const chips: { key: string; text: string; at: number }[] = [{ key: 'now', text: t('endNow'), at: now }];
  if (sugg.planned) chips.push({ key: 'planned', text: t('endPlanned', { t: label(sugg.planned) }), at: sugg.planned });
  if (sugg.firstFood) chips.push({ key: 'food', text: t('endFirstFood', { t: label(sugg.firstFood) }), at: sugg.firstFood });

  async function save() {
    const v = validateSessionTimes(session.startAt, endAt, Date.now());
    if (v) return setErr(t(v as TKey));
    await endFast(session.id, endAt);
    toast(t('saved'));
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('endFast')} footer={<Button className="w-full" onClick={save}>{t('endFast')}</Button>}>
      <div className="flex flex-col gap-4 py-1">
        <p className="text-[14px] text-ink2">{t('endWhenAte')}</p>
        <div className="flex flex-col gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setValue(toInputValue(c.at, tz))}
              className={cx('press min-h-[44px] rounded-[12px] px-4 text-left text-[14px] font-medium', value === toInputValue(c.at, tz) ? 'bg-mintsoft text-mint ring-2 ring-mint' : 'bg-bg2 text-ink')}
            >
              {c.text}
            </button>
          ))}
        </div>
        <TextInput label={t('endTime')} type="datetime-local" value={value} min={toInputValue(session.startAt, tz)} max={toInputValue(now, tz)} onChange={(e) => setValue(e.target.value)} error={err} />
        {preview && (
          <div className={cx('rounded-[12px] p-3.5', ok ? 'bg-goldsoft' : 'bg-bg2')}>
            <div className="flex items-center justify-between">
              <span className="num text-[24px] font-semibold">{formatDuration(fasted, false)} {t('h')}</span>
              <Badge tone={ok ? 'gold' : 'muted'}>{ok ? t('verified') : t('notCompleted')}</Badge>
            </div>
            <div className="mt-1 text-[12px] text-ink3">{ok ? t('endFastDone') : t('endFastEarly', { h: session.targetHours })}</div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
