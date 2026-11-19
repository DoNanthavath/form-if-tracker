import { useState } from 'react';
import { Activity, ChevronRight, Plus, Scale, Utensils } from 'lucide-react';
import { useApp } from '../app/context';
import { useActivitiesSince, useFasts, useFoodsOn, useWeights } from '../hooks/data';
import { FastHero } from '../components/FastHero';
import { WeekRings } from '../components/WeekRings';
import { Card, Empty, ProgressBar, SectionTitle } from '../components/ui';
import { MacroSummary } from '../components/MacroSummary';
import { WaterCard } from '../components/WaterCard';
import { FoodSheet } from '../components/FoodSheet';
import { WeightSheet } from '../components/WeightSheet';
import { ActivitySheet } from '../components/ActivitySheet';
import { sumMacros } from '../lib/nutrition';
import { activeGoal, goalProgress, latest } from '../lib/weight';
import { dailyFastStats, currentStreak } from '../lib/fasting';
import { lastNDates, timeKey, zonedInstant } from '../lib/time';
import type { Tab } from '../App';
import { Sparkline } from '../components/Sparkline';

export function HomePage({ go }: { go: (t: Tab) => void }) {
  const { t, today, now, tz, settings, fmtDate, fmtNum } = useApp();
  const foods = useFoodsOn(today) ?? [];
  const weights = useWeights() ?? [];
  const fasts = useFasts();
  const acts = useActivitiesSince(1, today);
  const stepsToday = acts.reduce((a, x) => a + (x.steps ?? 0), 0);
  const minutesToday = acts.reduce((a, x) => a + (x.minutes ?? 0), 0);
  const [sheet, setSheet] = useState<null | 'food' | 'weight' | 'activity'>(null);
  const totals = sumMacros(foods);
  const last = latest(weights);
  const current = last?.kg ?? settings.startWeightKg;
  const goal = activeGoal(settings.goalWeightsKg, current) ?? Math.min(...settings.goalWeightsKg, current);
  const gp = goalProgress(settings.startWeightKg, current, goal);
  const week = dailyFastStats(fasts, lastNDates(today, 7), tz);
  const weekDone = week.filter((d) => d.completed > 0).length;
  const streak = currentStreak(fasts, today, tz);
  const h = Number(timeKey(now, tz).slice(0, 2));
  const greet = h < 12 ? t('greetingMorning') : h < 17 ? t('greetingAfternoon') : t('greetingEvening');

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between pt-2">
        <div>
          <div className="text-[13px] font-semibold uppercase text-ink3">{fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="text-[34px] leading-[41px] font-bold tracking-[0.01em]">{greet}</h1>
        </div>
        <div className="mb-1.5 rounded-full bg-mintsoft px-2.5 py-1 text-[13px] font-semibold text-mint">{settings.protocol}</div>
      </header>

      <Card className="anim-in">
        <WeekRings />
        <div className="mt-6">
          <FastHero size={248} compact />
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { k: 'food' as const, icon: <Utensils size={20} />, label: t('quickFood') },
          { k: 'weight' as const, icon: <Scale size={20} />, label: t('quickWeight') },
          { k: 'activity' as const, icon: <Activity size={20} />, label: t('quickActivity') },
        ].map((a) => (
          <button key={a.k} type="button" onClick={() => setSheet(a.k)} className="press card flex flex-col items-center gap-1.5 px-2 py-3 text-[13px] font-medium">
            <span className="grid h-9 w-9 place-items-center text-mint">{a.icon}</span>
            <span className="flex items-center gap-0.5">{a.label}</span>
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle action={<LinkBtn onClick={() => go('food')} label={t('viewAll')} />}>{t('caloriesToday')}</SectionTitle>
        <MacroSummary totals={totals} compact />
      </Card>

      <Card>
        <SectionTitle action={<LinkBtn onClick={() => go('progress')} label={t('viewAll')} />}>{t('latestWeight')}</SectionTitle>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="num text-[34px] font-semibold leading-none">
              {fmtNum(current)} <span className="text-[15px] text-ink3">kg</span>
            </div>
            <div className="mt-1 text-[12px] text-ink3">{last ? fmtDate(zonedInstant(last.date, '12:00', tz), { day: 'numeric', month: 'short' }) : t('noWeightYet')}</div>
          </div>
          <Sparkline values={weights.slice(-30).map((w) => w.kg)} className="h-14 w-32" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-[12px]">
          <div><div className="text-ink3">{t('lostSoFar')}</div><div className="num text-[16px] font-semibold text-mint">{fmtNum(gp.lost)} kg</div></div>
          <div><div className="text-ink3">{t('leftToLose')}</div><div className="num text-[16px] font-semibold">{fmtNum(gp.remaining)} kg</div></div>
          <div><div className="text-ink3">{t('goalWeight')}</div><div className="num text-[16px] font-semibold">{fmtNum(goal)} kg</div></div>
        </div>
        <ProgressBar className="mt-3" value={gp.progress} label={t('goalProgress', { g: goal })} />
      </Card>

      <Card>
        <SectionTitle action={<LinkBtn onClick={() => setSheet('food')} label={t('add')} icon />}>{t('todaysMeals')}</SectionTitle>
        {foods.length === 0 ? (
          <Empty icon={<Utensils size={20} />} title={t('noMealsToday')} />
        ) : (
          <ul className="divide-y divide-line">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{f.name}</div>
                  <div className="text-[12px] text-ink3">{f.time} · {t(`meal_${f.mealType}`)} · P {f.protein} g</div>
                </div>
                <div className="num shrink-0 text-[14px] font-semibold">{f.kcal}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle action={<LinkBtn onClick={() => go('progress')} label={t('viewAll')} />}>{t('stepsToday')}</SectionTitle>
        <div className="flex items-baseline gap-3">
          <span className="num text-[34px] font-semibold leading-none">{stepsToday ? fmtNum(stepsToday, 0) : '—'}</span>
          {minutesToday > 0 && <span className="text-[15px] text-ink2">{t('activeToday', { n: minutesToday })}</span>}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <SectionTitle>{t('waterToday')}</SectionTitle>
          <WaterCard />
        </Card>
        <Card>
          <SectionTitle action={<LinkBtn onClick={() => go('fasting')} label={t('viewAll')} />}>{t('weeklyConsistency')}</SectionTitle>
          <div className="num text-[34px] font-semibold leading-none">
            {weekDone}<span className="text-[16px] text-ink3">/7</span>
          </div>
          <div className="mt-1 text-[12px] text-ink3">{t('last7')} · {t('fastStreak')} {streak} {t('days')}</div>
          <div className="mt-4 flex h-16 items-end gap-1.5" aria-hidden="true">
            {week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col justify-end rounded-md bg-[var(--track)]" style={{ height: '100%' }}>
                <div className={`rounded-md ${d.completed ? 'bg-gold' : 'bg-ink3/50'}`} style={{ height: `${Math.max(d.completed ? 100 : d.bestProgress * 100, 0)}%` }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <FoodSheet open={sheet === 'food'} onClose={() => setSheet(null)} date={today} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} />
      <ActivitySheet open={sheet === 'activity'} onClose={() => setSheet(null)} />
    </div>
  );
}

function LinkBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="press -mr-1 flex min-h-[36px] items-center gap-0.5 rounded-lg px-2 text-[15px] text-mint">
      {icon && <Plus size={15} />}
      {label}
      {!icon && <ChevronRight size={15} />}
    </button>
  );
}
