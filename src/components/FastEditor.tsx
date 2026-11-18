import { useEffect, useState } from 'react';
import { Button, Select, Sheet, TextInput } from './ui';
import { useApp } from '../app/context';
import { PROTOCOLS, PROTOCOL_IDS, validateSessionTimes } from '../lib/fasting';
import type { FastSession, ProtocolId } from '../lib/types';
import { fromInputValue, toInputValue } from '../lib/datetimeInput';
import { saveFastTimes, startFast } from '../db/repo';
import { useToast } from './Toast';
import type { TKey } from '../i18n';
import { HOUR } from '../lib/time';

/**
 * mode 'start'  – start a new tracked fast (optionally back-dated)
 * mode 'edit'   – change times of an existing session
 * mode 'add'    – add a completed past fast manually
 */
export function FastEditor({ open, onClose, mode, session, defaultStart }: { open: boolean; onClose: () => void; mode: 'start' | 'edit' | 'add'; session?: FastSession | null; defaultStart?: number }) {
  const { t, tz, settings, now } = useApp();
  const toast = useToast();
  const [protocol, setProtocol] = useState<ProtocolId>(settings.protocol);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const n = Date.now();
    setErr(null);
    if (session) {
      setProtocol(session.protocol);
      setStart(toInputValue(session.startAt, tz));
      setEnd(session.endAt ? toInputValue(session.endAt, tz) : '');
    } else {
      setProtocol(settings.protocol);
      const s = defaultStart ?? n;
      setStart(toInputValue(s, tz));
      setEnd(mode === 'add' ? toInputValue(Math.min(n, s + PROTOCOLS[settings.protocol].fast * HOUR), tz) : '');
    }
  }, [open, session, defaultStart, mode, tz, settings.protocol]);

  const showEnd = mode === 'add' || (mode === 'edit' && session?.status === 'ended');

  async function submit() {
    const s = fromInputValue(start, tz);
    const e = showEnd ? fromInputValue(end, tz) : null;
    const v = validateSessionTimes(s, e, Date.now());
    if (v) return setErr(t(v as TKey));
    try {
      if (mode === 'start') await startFast(protocol, s);
      else await saveFastTimes(session?.id ?? null, protocol, PROTOCOLS[protocol].fast, s, e);
      toast(t('saved'));
      onClose();
    } catch (x) {
      const key = (x as Error).message as TKey;
      setErr(t(key) === key ? t('errorGeneric') : t(key));
    }
  }

  const title = mode === 'start' ? t('startFast') : mode === 'edit' ? t('editFast') : t('addPastFast');
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button className="w-full" onClick={submit}>
          {mode === 'start' ? t('startFast') : t('save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <Select label={t('protocol')} value={protocol} onChange={setProtocol} options={PROTOCOL_IDS.map((p) => ({ value: p, label: `${p}  ·  ${PROTOCOLS[p].fast} ${t('h')}` }))} />
        <TextInput label={t('startTime')} type="datetime-local" value={start} max={toInputValue(now, tz)} onChange={(e) => setStart(e.target.value)} error={!showEnd ? err : null} />
        {showEnd && <TextInput label={t('endTime')} type="datetime-local" value={end} max={toInputValue(now, tz)} onChange={(e) => setEnd(e.target.value)} error={err} />}
        <p className="text-xs leading-relaxed text-ink3">{t('plannedVsVerified')}</p>
      </div>
    </Sheet>
  );
}
