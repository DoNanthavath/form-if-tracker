import { useApp } from '../app/context';
import { useFasts } from '../hooks/data';
import { dailyFastStats } from '../lib/fasting';
import { shiftDate, weekStart } from '../lib/time';
import { MiniRing } from './Ring';
import { zonedInstant } from '../lib/time';

/** Mon–Sun rings. Filled = verified completed fast ending that day; partial = best progress. */
export function WeekRings() {
  const { today, tz, fmtDate, t } = useApp();
  const fasts = useFasts();
  const start = weekStart(today);
  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(start, i));
  const stats = dailyFastStats(fasts, dates, tz);
  return (
    <div className="flex justify-between gap-1" aria-label={t('thisWeek')}>
      {stats.map((s) => {
        const ms = zonedInstant(s.date, '12:00', tz);
        const label = fmtDate(ms, { weekday: 'short' });
        const value = s.completed > 0 ? 1 : s.bestProgress * 0.999;
        const future = s.date > today;
        return (
          <div key={s.date} className={future ? 'opacity-50' : ''}>
            <MiniRing value={value} size={42} active={s.date === today} label={`${fmtDate(ms, { weekday: 'long' })}: ${s.completed > 0 ? t('verified') : s.sessions ? t('notCompleted') : '—'}`}>
              {label.replace('.', '').slice(0, 2)}
            </MiniRing>
          </div>
        );
      })}
    </div>
  );
}
