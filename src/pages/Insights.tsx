import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../app/context';
import { useFasts, useFoodsSince, useWaterSince } from '../hooks/data';
import { db } from '../db/db';
import { Card, ProgressBar, SectionTitle, Segmented, StatTile } from '../components/ui';
import { computeInsights } from '../lib/insights';
import { lastNDates, shiftDate, zonedInstant } from '../lib/time';
import { MEAL_TYPES } from '../lib/nutrition';
import { PROTOCOLS } from '../lib/fasting';
import { useChartColors } from '../hooks/useChartColors';
import { dm } from '../lib/chartFmt';

export function InsightsView() {
  const { t, today, tz, settings, fmtNum, fmtDate } = useApp();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const n = Number(range);
  const foods = useFoodsSince(n, today);
  const fasts = useFasts();
  const water = useWaterSince(n, today);
  const weights = useLiveQuery(() => db.weights.where('date').between(shiftDate(today, -(n - 1)), today, true, true).toArray(), [n, today]) ?? [];
  const c = useChartColors();

  const ins = useMemo(() => computeInsights({ dates: lastNDates(today, n), foods, fasts, weights, water, settings, tz }), [today, n, foods, fasts, weights, water, settings, tz]);
  const tip = { contentStyle: { background: c.card, border: `1px solid ${c.line}`, borderRadius: 12 }, cursor: { fill: c.track } };
  const axis = { tick: { fill: c.ink3, fontSize: 11 }, axisLine: false, tickLine: false } as const;
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  const weightRows = ins.days.filter((d) => d.weight != null);

  return (
    <>
      <Segmented label={t('range')} value={range} onChange={setRange} options={[{ value: '7', label: t('last7') }, { value: '30', label: t('last30') }, { value: '90', label: t('last90') }]} />
      <div className="grid grid-cols-2 gap-3">
        <StatTile label={t('avgKcal')} value={ins.avgKcal != null ? fmtNum(ins.avgKcal, 0) : '—'} sub={t('daysLogged', { n: ins.loggedDays })} accent />
        <StatTile label={t('avgProtein')} value={ins.avgProtein != null ? `${fmtNum(ins.avgProtein, 0)} g` : '—'} sub={`${t('target')} ${settings.proteinG} g`} />
      </div>

      <Card>
        <SectionTitle>{t('calorieTrend')}</SectionTitle>
        <div className="h-48" role="img" aria-label={t('calorieTrend')}>
          <ResponsiveContainer>
            <BarChart data={ins.days} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={c.line} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dm} minTickGap={16} {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tip} formatter={(v) => [`${v} kcal`, t('calories')]} />
              <ReferenceLine y={settings.kcalBudget} stroke={c.mint} strokeDasharray="5 5" />
              <Bar dataKey="kcal" fill={c.mint} radius={[5, 5, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('proteinTrend')}</SectionTitle>
        <div className="h-44" role="img" aria-label={t('proteinTrend')}>
          <ResponsiveContainer>
            <BarChart data={ins.days} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={c.line} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dm} minTickGap={16} {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tip} formatter={(v) => [`${v} g`, t('protein')]} />
              <ReferenceLine y={settings.proteinG} stroke={c.protein} strokeDasharray="5 5" />
              <Bar dataKey="protein" fill={c.protein} radius={[5, 5, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('fastingTrend')}</SectionTitle>
        <div className="h-44" role="img" aria-label={t('fastingTrend')}>
          <ResponsiveContainer>
            <BarChart data={ins.days} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={c.line} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dm} minTickGap={16} {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tip} formatter={(v) => [`${v} ${t('h')}`, t('fastingTrend')]} />
              <ReferenceLine y={PROTOCOLS[settings.protocol].fast} stroke={c.mint} strokeDasharray="5 5" />
              <Bar dataKey="fastHours" fill={c.mint2} radius={[5, 5, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {weightRows.length >= 2 && (
        <Card>
          <SectionTitle>{t('weightTrend')}</SectionTitle>
          <div className="h-44" role="img" aria-label={t('weightTrend')}>
            <ResponsiveContainer>
              <LineChart data={weightRows} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={c.line} vertical={false} />
                <XAxis dataKey="date" tickFormatter={dm} minTickGap={16} {...axis} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} allowDecimals={false} {...axis} />
                <Tooltip {...tip} formatter={(v) => [`${v} kg`, t('weight')]} />
                <Line type="monotone" dataKey="weight" stroke={c.mint} strokeWidth={2.5} dot={{ r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>{t('adherence')}</SectionTitle>
        <div className="flex flex-col gap-3">
          {[
            { label: t('withinBudget'), v: ins.adherence.withinBudget, color: 'var(--mint)' },
            { label: t('proteinHit'), v: ins.adherence.proteinHit, color: 'var(--protein)' },
            { label: t('fastsHit'), v: ins.adherence.fasts, color: 'var(--mint2)' },
            { label: t('waterHit'), v: ins.adherence.water, color: 'var(--water)' },
          ].map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="text-ink2">{r.label}</span>
                <span className="num font-semibold">{pct(r.v)}</span>
              </div>
              <ProgressBar value={r.v ?? 0} color={r.color} label={r.label} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink3">{t('daysLogged', { n: ins.loggedDays })}</p>
      </Card>

      <Card>
        <SectionTitle>{t('mealPatterns')}</SectionTitle>
        <div className="text-[12px] text-ink3">{t('byMeal')}</div>
        <div className="mt-2 flex flex-col gap-2">
          {MEAL_TYPES.map((m) => {
            const max = Math.max(1, ...Object.values(ins.byMeal));
            return (
              <div key={m} className="grid grid-cols-[88px_1fr_56px] items-center gap-2 text-[13px]">
                <span className="text-ink2">{t(`meal_${m}`)}</span>
                <ProgressBar value={ins.byMeal[m] / max} label={t(`meal_${m}`)} />
                <span className="num text-right font-semibold">{ins.byMeal[m]}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-[12px] bg-bg2 p-3">
          <div>
            <div className="text-[13px] font-medium">{t('inWindow')}</div>
            <div className="text-[11px] text-ink3">{t('inWindowHint')}</div>
          </div>
          <div className="num text-[22px] font-semibold text-mint">{pct(ins.inWindowPct)}</div>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('weeklyAverages')}</SectionTitle>
        <GroupTable rows={ins.weekly.slice().reverse()} label={(k) => fmtDate(zonedInstant(k, '12:00', tz), { day: 'numeric', month: 'short' })} />
      </Card>
      {n >= 30 && (
        <Card>
          <SectionTitle>{t('monthly')}</SectionTitle>
          <GroupTable rows={ins.monthly.slice().reverse()} label={(k) => fmtDate(zonedInstant(`${k}-15`, '12:00', tz), { month: 'long', year: 'numeric' })} />
        </Card>
      )}
      <p className="px-1 text-[11px] leading-relaxed text-ink3">{t('insightsDisclaimer')}</p>
    </>
  );
}

function GroupTable({ rows, label }: { rows: ReturnType<typeof computeInsights>['weekly']; label: (k: string) => string }) {
  const { t, fmtNum } = useApp();
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[320px] text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-ink3">
            <th className="px-1 py-1.5 font-medium">{t('date')}</th>
            <th className="px-1 py-1.5 text-right font-medium">kcal</th>
            <th className="px-1 py-1.5 text-right font-medium">{t('protein')}</th>
            <th className="px-1 py-1.5 text-right font-medium">IF ✓</th>
            <th className="px-1 py-1.5 text-right font-medium">kg</th>
          </tr>
        </thead>
        <tbody className="num">
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="px-1 py-2 font-sans">{label(r.key)}</td>
              <td className="px-1 py-2 text-right">{r.avgKcal != null ? fmtNum(r.avgKcal, 0) : '—'}</td>
              <td className="px-1 py-2 text-right">{r.avgProtein != null ? `${fmtNum(r.avgProtein, 0)} g` : '—'}</td>
              <td className="px-1 py-2 text-right">{r.completedFasts}</td>
              <td className="px-1 py-2 text-right">{r.avgWeight != null ? fmtNum(r.avgWeight) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
