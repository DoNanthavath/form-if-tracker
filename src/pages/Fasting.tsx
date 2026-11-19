import { useState } from 'react';
import { Flame, Pencil, Plus, Timer, Trash2, Trophy } from 'lucide-react';
import { useApp } from '../app/context';
import { useFasts } from '../hooks/data';
import { FastHero } from '../components/FastHero';
import { WeekRings } from '../components/WeekRings';
import { Badge, Button, Card, Empty, SectionTitle, StatTile } from '../components/ui';
import { PROTOCOLS, currentStreak, fastedMs, fastingStartTime, isVerifiedComplete, longestStreak, summarizeFasts } from '../lib/fasting';
import { HOUR, formatDuration } from '../lib/time';
import { FastEditor } from '../components/FastEditor';
import { deleteFast } from '../db/repo';
import { useConfirm } from '../components/Confirm';
import type { FastSession } from '../lib/types';
import { PageHeader } from '../components/PageHeader';

export function FastingPage() {
  const { t, today, tz, settings, fmtDate, fmtTime, fmtNum } = useApp();
  const fasts = useFasts();
  const confirm = useConfirm();
  const [edit, setEdit] = useState<{ mode: 'edit' | 'add'; session: FastSession | null } | null>(null);
  const [limit, setLimit] = useState(20);
  const streak = currentStreak(fasts, today, tz);
  const best = longestStreak(fasts, tz);
  const week = summarizeFasts(fasts, today, 7, tz);
  const month = summarizeFasts(fasts, today, 30, tz);
  const history = fasts.filter((f) => f.status === 'ended');
  const dt = (ms: number) => `${fmtDate(ms, { day: 'numeric', month: 'short' })} ${fmtTime(ms)}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('navFasting')} subtitle={`${settings.protocol} · ${t('eatingWindow')} ${settings.eatingStart}–${fastingStartTime(settings)}`} />
      <Card>
        <WeekRings />
      </Card>
      <Card className="pt-6">
        <FastHero size={300} />
        <p className="mt-4 text-center text-[12px] text-ink3">{t('fastingNote')}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t('fastStreak')} value={<span className="inline-flex items-center gap-1.5"><Flame size={18} className="text-gold" />{streak}</span>} sub={t('days')} accent="gold" />
        <StatTile label={t('longestStreak')} value={<span className="inline-flex items-center gap-1.5"><Trophy size={18} className="text-gold" />{best}</span>} sub={t('days')} />
        <StatTile label={`${t('completionRate')} · ${t('last7')}`} value={`${Math.round(week.completionRate * 100)}%`} sub={t('fastsCompleted', { n: week.daysWithCompletion, d: 7 })} />
        <StatTile label={`${t('avgFast')} · ${t('last30')}`} value={`${fmtNum(month.avgHours)} ${t('h')}`} sub={`max ${fmtNum(month.longestHours)} ${t('h')}`} />
      </div>

      <Card>
        <SectionTitle>{t('scheduleTitle')}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 text-[14px]">
          <div className="rounded-[12px] bg-fat/10 p-3">
            <div className="text-[12px] text-ink3">{t('eatingWindow')}</div>
            <div className="num text-[18px] font-semibold">{settings.eatingStart}–{fastingStartTime(settings)}</div>
            <div className="text-[12px] text-ink3">{PROTOCOLS[settings.protocol].eat} {t('h')}</div>
          </div>
          <div className="rounded-[12px] bg-mintsoft p-3">
            <div className="text-[12px] text-ink3">{t('fastingWindow')}</div>
            <div className="num text-[18px] font-semibold">{fastingStartTime(settings)}–{settings.eatingStart}</div>
            <div className="text-[12px] text-ink3">{PROTOCOLS[settings.protocol].fast} {t('h')}</div>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-ink3">{t('plannedVsVerified')}</p>
      </Card>

      <Card>
        <SectionTitle action={<Button variant="secondary" className="!min-h-[38px] !px-3 text-[13px]" onClick={() => setEdit({ mode: 'add', session: null })}><Plus size={16} />{t('addPastFast')}</Button>}>
          {t('fastHistory')}
        </SectionTitle>
        {history.length === 0 ? (
          <Empty icon={<Timer size={20} />} title={t('noFasts')} hint={t('noFastsHint')} />
        ) : (
          <ul className="divide-y divide-line">
            {history.slice(0, limit).map((f) => {
              const ok = isVerifiedComplete(f);
              const fasted = fastedMs(f, f.endAt!);
              return (
                <li key={f.id} className="flex items-center gap-3 py-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${ok ? 'bg-gold text-goldink' : 'bg-card2 text-ink3'}`} aria-hidden="true">
                    <span className="num text-[12px] font-bold">{Math.min(99, Math.round((fasted / (f.targetHours * HOUR)) * 100))}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="num text-[15px] font-semibold">{formatDuration(fasted, false)}</span>
                      <span className="text-[12px] text-ink3">/ {f.targetHours} {t('h')}</span>
                      <Badge tone={ok ? 'gold' : 'muted'}>{ok ? t('verified') : t('notCompleted')}</Badge>
                      {f.edited && <Badge tone="warn">{t('editedBadge')}</Badge>}
                    </div>
                    <div className="truncate text-[12px] text-ink3">
                      {dt(f.startAt)} → {dt(f.endAt!)}
                    </div>
                  </div>
                  <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink2 hover:bg-card2" aria-label={t('editFast')} onClick={() => setEdit({ mode: 'edit', session: f })}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink3 hover:text-danger" aria-label={t('delete')} onClick={async () => (await confirm({ title: t('deleteFastConfirm'), danger: true, confirmLabel: t('delete') })) && deleteFast(f.id)}>
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {history.length > limit && (
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setLimit(limit + 30)}>
            {t('more')}
          </Button>
        )}
      </Card>
      <FastEditor open={!!edit} onClose={() => setEdit(null)} mode={edit?.mode ?? 'add'} session={edit?.session ?? null} />
    </div>
  );
}
