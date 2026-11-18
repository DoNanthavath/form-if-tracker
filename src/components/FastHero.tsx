import { useState } from 'react';
import { CalendarClock, Pause, Play, Square } from 'lucide-react';
import { Ring } from './Ring';
import { Badge, Button } from './ui';
import { useApp } from '../app/context';
import { useActiveFast } from '../hooks/data';
import { PROTOCOLS, fastedMs, plannedPhase, projectedGoalAt, sessionProgress, targetMs } from '../lib/fasting';
import { formatDuration, HOUR } from '../lib/time';
import { endFast, pauseFast, resumeFast } from '../db/repo';
import { FastEditor } from './FastEditor';
import { useConfirm } from './Confirm';
import { useToast } from './Toast';

export function FastHero({ size = 280, compact = false }: { size?: number; compact?: boolean }) {
  const { t, now, tz, settings, fmtDate, fmtTime } = useApp();
  const session = useActiveFast();
  const confirm = useConfirm();
  const toast = useToast();
  const [editor, setEditor] = useState<null | 'start' | 'edit'>(null);
  const plan = plannedPhase(now, settings, tz);
  const dt = (ms: number) => `${fmtDate(ms, { weekday: 'short', day: 'numeric' })}, ${fmtTime(ms)}`;

  if (session === undefined) return <div style={{ height: size }} aria-busy="true" />;

  const onEnd = async () => {
    if (!session) return;
    const fasted = fastedMs(session, Date.now());
    const ok = fasted >= targetMs(session);
    const yes = await confirm({
      title: t('endFastConfirm'),
      body: ok ? t('endFastDone') : t('endFastEarly', { h: session.targetHours }),
      confirmLabel: t('endFast'),
      danger: !ok,
    });
    if (yes) {
      await endFast(session.id);
      toast(t('saved'));
    }
  };

  if (session) {
    const progress = sessionProgress(session, now);
    const pct = Math.floor(progress * 100);
    const fasted = fastedMs(session, now);
    const remaining = Math.max(0, targetMs(session) - fasted);
    const paused = session.status === 'paused';
    return (
      <div className="flex flex-col items-center">
        <Ring value={progress} size={size} stroke={compact ? 18 : 26} label={`${t('elapsed')} ${pct}%`} id="fast">
          <Badge tone={paused ? 'warn' : 'mint'}>{session.protocol}</Badge>
          <div className={`num mt-2 font-semibold ${compact ? 'text-[40px]' : 'text-[52px]'} leading-none ${paused ? 'text-ink2' : 'text-ink'}`} aria-live="off">
            {formatDuration(fasted)}
          </div>
          <div className="mt-2 text-[14px] font-medium text-ink2">
            {progress >= 1 ? t('goalReached') : paused ? t('pausedPct', { pct }) : t('elapsedPct', { pct })}
          </div>
          {!compact && progress < 1 && (
            <div className="mt-1 text-[12px] text-ink3">
              {t('remaining')} {formatDuration(remaining, false)}
            </div>
          )}
        </Ring>
        <div className="mt-5 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-ink3">{t('started')}</div>
            <button type="button" className="text-[15px] font-semibold text-ink underline-offset-4 hover:underline" onClick={() => setEditor('edit')}>
              {dt(session.startAt)}
            </button>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-mint text-mintink" aria-hidden="true">
            <CalendarClock size={22} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink3">{t('goalAt', { h: session.targetHours })}</div>
            <div className="text-[15px] font-semibold">{dt(projectedGoalAt(session, now))}</div>
          </div>
        </div>
        <div className="mt-5 flex w-full gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => (paused ? resumeFast(session.id) : pauseFast(session.id))}>
            {paused ? <Play size={18} /> : <Pause size={18} />}
            {paused ? t('resume') : t('pause')}
          </Button>
          <Button className="flex-[2]" onClick={onEnd}>
            <Square size={16} />
            {t('endFast')}
          </Button>
        </div>
        <FastEditor open={editor === 'edit'} onClose={() => setEditor(null)} mode="edit" session={session} />
      </div>
    );
  }

  // No tracked fast: show the planned schedule, clearly labelled as a plan.
  const isFast = plan.phase === 'fasting';
  // Default back-dated start: the planned fast start, if it's earlier today/last night.
  const suggestedStart = isFast && Date.now() - plan.start < PROTOCOLS[settings.protocol].fast * HOUR ? plan.start : Date.now();
  return (
    <div className="flex flex-col items-center">
      <Ring value={plan.progress} size={size} stroke={compact ? 18 : 26} label={`${t('plannedLabel')} ${isFast ? t('phaseFasting') : t('phaseEating')}`} color={isFast ? 'var(--mint)' : 'var(--fat)'} color2={isFast ? 'var(--mint2)' : '#ffe0a8'} id="plan">
        <Badge tone="muted">
          {t('plannedLabel')} · {settings.protocol}
        </Badge>
        <div className={`mt-2 text-[13px] font-semibold ${isFast ? 'text-mint' : 'text-fat'}`}>{isFast ? t('phaseFasting') : t('phaseEating')}</div>
        <div className={`num mt-1 font-semibold ${compact ? 'text-[38px]' : 'text-[48px]'} leading-none`}>{formatDuration(plan.remaining)}</div>
        <div className="mt-2 text-[13px] text-ink2">{isFast ? t('untilEating') : t('untilFasting')}</div>
      </Ring>
      <p className="mt-4 max-w-xs text-center text-[13px] leading-relaxed text-ink3">{isFast ? t('plannedFastingHint') : t('plannedEatingHint')}</p>
      <div className="mt-4 flex w-full flex-col gap-2">
        <Button className="w-full" onClick={() => setEditor('start')}>
          <Play size={18} />
          {t('startFast')}
        </Button>
      </div>
      <FastEditor open={editor === 'start'} onClose={() => setEditor(null)} mode="start" defaultStart={suggestedStart} />
    </div>
  );
}
