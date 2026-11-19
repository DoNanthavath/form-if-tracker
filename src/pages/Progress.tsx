import { useMemo, useState } from 'react';
import { Check, Footprints, Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { useApp } from '../app/context';
import { useActivitiesSince, useWaterSince, useWeights } from '../hooks/data';
import { Badge, Button, Card, Empty, ProgressBar, SectionTitle, Segmented, StatTile } from '../components/ui';
import { PageHeader } from '../components/PageHeader';
import { WeightSheet } from '../components/WeightSheet';
import { ActivitySheet } from '../components/ActivitySheet';
import { WaterCard } from '../components/WaterCard';
import { activeGoal, averageInWindow, bmi, bmiCategory, changeOver, goalProgress, latest, movingAverage, trendPerWeek, weeksToGoalEstimate } from '../lib/weight';
import { lastNDates, shiftDate, zonedInstant } from '../lib/time';
import type { ActivityEntry, WeightEntry } from '../lib/types';
import { deleteActivity, deleteWeight } from '../db/repo';
import { useConfirm } from '../components/Confirm';
import { useChartColors } from '../hooks/useChartColors';
import { dm } from '../lib/chartFmt';
import { InsightsView } from './Insights';

type View = 'weight' | 'activity' | 'insights';

export function ProgressPage() {
  const { t } = useApp();
  const [view, setView] = useState<View>('weight');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('navProgress')} />
      <Segmented label={t('navProgress')} value={view} onChange={setView} options={[{ value: 'weight', label: t('tabWeight') }, { value: 'activity', label: t('tabActivity') }, { value: 'insights', label: t('tabInsights') }]} />
      {view === 'weight' && <WeightView />}
      {view === 'activity' && <ActivityView />}
      {view === 'insights' && <InsightsView />}
    </div>
  );
}

function signed(n: number | null, fmt: (n: number) => string) {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${fmt(n)}`;
}

function WeightView() {
  const { t, today, tz, settings, fmtNum, fmtDate } = useApp();
  const weights = useWeights();
  const confirm = useConfirm();
  const c = useChartColors();
  const [sheet, setSheet] = useState<{ open: boolean; entry: WeightEntry | null }>({ open: false, entry: null });
  const [range, setRange] = useState<'30' | '90' | 'all'>('90');
  const [limit, setLimit] = useState(15);

  const list = weights ?? [];
  const last = latest(list);
  const current = last?.kg ?? settings.startWeightKg;
  const goals = [...settings.goalWeightsKg].sort((a, b) => b - a);
  const goal = activeGoal(goals, current);
  const finalGoal = goals[goals.length - 1] ?? current;
  const gp = goalProgress(settings.startWeightKg, current, goal ?? finalGoal);
  const b = bmi(current, settings.heightCm);
  const trend = trendPerWeek(list, today);
  const weeks = goal != null ? weeksToGoalEstimate(current, goal, trend) : null;
  const latestWaist = [...list].reverse().find((w) => w.waistCm != null)?.waistCm ?? null;

  const chartData = useMemo(() => {
    const from = range === 'all' ? '0000' : shiftDate(today, -(Number(range) - 1));
    return movingAverage(list).filter((p) => p.date >= from);
  }, [list, range, today]);

  const yDomain = useMemo(() => {
    const vals = [...chartData.map((p) => p.kg), goal ?? current];
    return [Math.floor(Math.min(...vals) - 1), Math.ceil(Math.max(...vals) + 1)];
  }, [chartData, goal, current]);

  if (weights === undefined) return <div aria-busy="true" className="h-40" />;

  return (
    <>
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[13px] text-ink3">{t('latestWeight')}</div>
            <div className="num text-[44px] font-semibold leading-none">
              {fmtNum(current)}
              <span className="text-[16px] text-ink3"> kg</span>
            </div>
            <div className="mt-1 text-[12px] text-ink3">{last ? fmtDate(zonedInstant(last.date, '12:00', tz), { weekday: 'short', day: 'numeric', month: 'short' }) : t('noWeightYet')}</div>
          </div>
          <Button onClick={() => setSheet({ open: true, entry: null })} className="!px-4">
            <Plus size={18} />
            {t('logWeight')}
          </Button>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-[12px] text-ink2">
            <span>{goal != null ? t('goalProgress', { g: goal }) : t('allGoalsReached')}</span>
            <span className="num">{Math.round(gp.progress * 100)}%</span>
          </div>
          <ProgressBar value={gp.progress} label={t('goalProgress', { g: goal ?? finalGoal })} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('totalLost')} value={`${fmtNum(gp.lost)} kg`} accent={gp.lost > 0 ? 'gold' : true} />
          <StatTile label={t('toGoal')} value={`${fmtNum(gp.remaining)} kg`} />
          <StatTile label={t('avg7')} value={averageInWindow(list, today) != null ? `${fmtNum(averageInWindow(list, today)!)} kg` : '—'} />
          <StatTile label={t('bmi')} value={b ?? '—'} sub={b ? t(`bmi_${bmiCategory(b)}`) : undefined} />
          <StatTile label={t('weekChange')} value={signed(changeOver(list, today, 7), (n) => `${fmtNum(n)} kg`)} />
          <StatTile label={t('monthChange')} value={signed(changeOver(list, today, 30), (n) => `${fmtNum(n)} kg`)} />
          <StatTile label={t('trend')} value={trend != null ? t('perWeek', { n: signed(trend, (n) => fmtNum(n, 2)) }) : '—'} sub={trend == null ? t('notEnoughData') : undefined} />
          <StatTile label={t('waist')} value={latestWaist != null ? `${fmtNum(latestWaist)} cm` : '—'} />
        </div>
        {weeks != null && goal != null && <p className="mt-3 rounded-[12px] bg-bg2 p-3 text-[12px] leading-relaxed text-ink2">{t('trendEstimate', { g: goal, w: weeks })}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-ink3">{t('bmiNote')}</p>
      </Card>

      <Card>
        <SectionTitle action={<Segmented label={t('range')} value={range} onChange={setRange} options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }, { value: 'all', label: 'All' }]} className="w-44" />}>{t('weightChart')}</SectionTitle>
        {chartData.length < 2 ? (
          <Empty icon={<Scale size={20} />} title={chartData.length ? t('notEnoughData') : t('noWeights')} hint={t('noWeightsHint')} />
        ) : (
          <div className="h-64 w-full" role="img" aria-label={`${t('weightChart')}: ${chartData.map((p) => `${p.date} ${p.kg}`).join(', ')}`}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.mint} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={c.mint} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={c.line} vertical={false} />
                <XAxis dataKey="date" tickFormatter={dm} tick={{ fill: c.ink3, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis domain={yDomain} tick={{ fill: c.ink3, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: c.card, border: `1px solid ${c.line}`, borderRadius: 12 }} labelFormatter={(l) => String(l)} formatter={(v, n) => [`${v} kg`, n === 'avg' ? t('movingAvg') : t('dailyWeight')]} />
                {goal != null && <ReferenceLine y={goal} stroke={c.mint} strokeDasharray="6 6" label={{ value: `${t('goalLine')} ${goal}`, fill: c.ink2, fontSize: 11, position: 'insideBottomRight' }} />}
                <Area type="monotone" dataKey="avg" stroke={c.mint} strokeWidth={2.5} fill="url(#wfill)" dot={false} isAnimationActive />
                <Line type="monotone" dataKey="kg" stroke={c.ink2} strokeWidth={0} dot={{ r: 3, fill: c.ink2 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-2 flex gap-4 text-[11px] text-ink3">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink2" />{t('dailyWeight')}</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-mint" />{t('movingAvg')}</span>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('milestones')}</SectionTitle>
        <ol className="flex flex-col gap-2">
          {goals.map((g) => {
            const done = current <= g;
            const p = goalProgress(settings.startWeightKg, current, g);
            return (
              <li key={g} className="flex items-center gap-3">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${done ? 'bg-mintfill text-mintink' : 'bg-[var(--fill)] text-ink3'}`}>{done ? <Check size={18} /> : <span className="num text-[11px]">{Math.round(p.progress * 100)}%</span>}</div>
                <div className="flex-1">
                  <div className="flex justify-between text-[14px]">
                    <span className="num font-semibold">{g} kg</span>
                    <span className="text-[12px] text-ink3">{done ? t('reached') : `${fmtNum(p.remaining)} kg`}</span>
                  </div>
                  <ProgressBar className="mt-1" value={p.progress} label={`${g} kg`} />
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <SectionTitle>{t('weightHistory')}</SectionTitle>
        {list.length === 0 ? (
          <Empty icon={<Scale size={20} />} title={t('noWeights')} hint={t('noWeightsHint')} />
        ) : (
          <ul className="divide-y divide-line">
            {[...list].reverse().slice(0, limit).map((w, i, arr) => {
              const prev = arr[i + 1];
              const diff = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
              return (
                <li key={w.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="num text-[15px] font-semibold">
                      {fmtNum(w.kg)} kg {diff != null && diff !== 0 && <span className={`text-[12px] ${diff < 0 ? 'text-mint' : 'text-ink3'}`}>{diff > 0 ? '+' : ''}{fmtNum(diff)}</span>}
                    </div>
                    <div className="truncate text-[12px] text-ink3">
                      {fmtDate(zonedInstant(w.date, '12:00', tz), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {w.waistCm != null && ` · ${t('waist')} ${w.waistCm}`}
                      {w.note && ` · ${w.note}`}
                    </div>
                  </div>
                  <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink2 hover:bg-card2" aria-label={`${t('edit')} ${w.date}`} onClick={() => setSheet({ open: true, entry: w })}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink3 hover:text-danger" aria-label={`${t('delete')} ${w.date}`} onClick={async () => (await confirm({ title: t('deleteWeightConfirm'), danger: true, confirmLabel: t('delete') })) && deleteWeight(w.id)}>
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > limit && <Button variant="ghost" className="mt-2 w-full" onClick={() => setLimit(limit + 30)}>{t('more')}</Button>}
      </Card>
      <WeightSheet open={sheet.open} entry={sheet.entry} onClose={() => setSheet({ open: false, entry: null })} />
    </>
  );
}

function ActivityView() {
  const { t, today, tz, settings, fmtDate, fmtNum } = useApp();
  const water = useWaterSince(7, today);
  const acts = useActivitiesSince(60, today);
  const confirm = useConfirm();
  const c = useChartColors();
  const [sheet, setSheet] = useState<{ open: boolean; entry: ActivityEntry | null }>({ open: false, entry: null });
  const days = lastNDates(today, 7);
  const waterData = days.map((d) => ({ date: d, ml: water.filter((w) => w.date === d).reduce((a, w) => a + w.ml, 0) }));
  const actData = days.map((d) => {
    const l = acts.filter((a) => a.date === d);
    return { date: d, minutes: l.reduce((s, a) => s + (a.minutes ?? 0), 0), steps: l.reduce((s, a) => s + (a.steps ?? 0), 0) };
  });
  const weekMinutes = actData.reduce((a, d) => a + d.minutes, 0);
  const stepDays = actData.filter((d) => d.steps > 0);
  const avgSteps = stepDays.length ? Math.round(stepDays.reduce((a, d) => a + d.steps, 0) / stepDays.length) : null;

  return (
    <>
      <Card>
        <SectionTitle>{t('waterToday')}</SectionTitle>
        <WaterCard />
        <div className="mt-5 h-32" role="img" aria-label={`${t('water')} ${t('last7')}`}>
          <ResponsiveContainer>
            <BarChart data={waterData} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
              <XAxis dataKey="date" tickFormatter={dm} tick={{ fill: c.ink3, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: c.ink3, fontSize: 10 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={settings.waterTargetMl} stroke={c.water} strokeDasharray="4 4" />
              <Bar dataKey="ml" fill={c.water} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label={`${t('activeMinutes')} · ${t('last7')}`} value={`${weekMinutes} ${t('min')}`} accent />
        <StatTile label={`${t('steps')} · avg`} value={avgSteps != null ? fmtNum(avgSteps, 0) : '—'} sub={avgSteps != null ? `${stepDays.length} ${t('days')}` : t('notEnoughData')} />
      </div>

      <Card>
        <SectionTitle action={<Button className="!min-h-[38px] !px-3 text-[13px]" onClick={() => setSheet({ open: true, entry: null })}><Plus size={16} />{t('add')}</Button>}>{t('activityHistory')}</SectionTitle>
        {acts.length === 0 ? (
          <Empty icon={<Footprints size={20} />} title={t('noActivity')} hint={t('healthNote')} />
        ) : (
          <ul className="divide-y divide-line">
            {acts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium">
                    {t(`act_${a.type}`)}
                    {a.kcal != null && <Badge tone="muted">{a.kcal} kcal</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-ink3">
                    {fmtDate(zonedInstant(a.date, '12:00', tz), { weekday: 'short', day: 'numeric', month: 'short' })}
                    {a.minutes != null && ` · ${a.minutes} ${t('min')}`}
                    {a.steps != null && ` · ${fmtNum(a.steps, 0)} ${t('steps')}`}
                    {a.note && ` · ${a.note}`}
                  </div>
                </div>
                <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink2 hover:bg-card2" aria-label={t('edit')} onClick={() => setSheet({ open: true, entry: a })}>
                  <Pencil size={16} />
                </button>
                <button type="button" className="press grid h-10 w-10 place-items-center rounded-full text-ink3 hover:text-danger" aria-label={t('delete')} onClick={async () => (await confirm({ title: t('deleteActivityConfirm'), danger: true, confirmLabel: t('delete') })) && deleteActivity(a.id)}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ActivitySheet open={sheet.open} entry={sheet.entry} onClose={() => setSheet({ open: false, entry: null })} />
    </>
  );
}
