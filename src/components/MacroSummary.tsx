import { Ring } from './Ring';
import { ProgressBar } from './ui';
import { useApp } from '../app/context';
import type { Macros } from '../lib/types';

/** Eaten / remaining / budget ring with macro pills (calories + protein focus). */
export function MacroSummary({ totals, compact = false }: { totals: Macros; compact?: boolean }) {
  const { t, settings, fmtNum } = useApp();
  const budget = settings.kcalBudget;
  const left = budget - totals.kcal;
  const over = left < 0;
  const size = compact ? 148 : 168;
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-center">
          <div className="num text-[20px] font-semibold">{fmtNum(totals.kcal, 0)}</div>
          <div className="text-[12px] text-ink3">{t('eaten')}</div>
        </div>
        <Ring value={totals.kcal / budget} size={size} stroke={12} label={`${t('calories')} ${totals.kcal}/${budget}`} id="kcal" color={over ? 'var(--danger)' : 'var(--mint)'} color2={over ? 'var(--fat)' : 'var(--mint2)'}>
          <div className={`num text-[30px] font-semibold leading-none ${over ? 'text-danger' : ''}`}>{fmtNum(Math.abs(left), 0)}</div>
          <div className="mt-1 text-[12px] text-ink2">{over ? t('overBudget') : t('remainingKcal')}</div>
        </Ring>
        <div className="text-center">
          <div className="num text-[20px] font-semibold">{fmtNum(budget, 0)}</div>
          <div className="text-[12px] text-ink3">{t('budget')}</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <MacroBar label={t('protein')} value={totals.protein} target={settings.proteinG} color="var(--protein)" kcalPerG={4} totalKcal={totals.kcal} />
        <MacroBar label={t('carbs')} value={totals.carbs} target={settings.carbsG} color="var(--carbs)" kcalPerG={4} totalKcal={totals.kcal} />
        <MacroBar label={t('fat')} value={totals.fat} target={settings.fatG} color="var(--fat)" kcalPerG={9} totalKcal={totals.kcal} />
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color, kcalPerG, totalKcal }: { label: string; value: number; target: number | null; color: string; kcalPerG: number; totalKcal: number }) {
  const { fmtNum, t } = useApp();
  // Without a gram target, show the macro's share of logged energy instead of a fake "full" bar.
  const share = totalKcal > 0 ? Math.min(1, (value * kcalPerG) / totalKcal) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[12px] text-ink3">{label}</span>
      </div>
      <div className="num mt-0.5 text-[15px] font-semibold">
        {fmtNum(value, 0)}
        <span className="text-[11px] font-normal text-ink3">{target ? ` / ${target} g` : ' g'}</span>
      </div>
      <ProgressBar className="mt-1.5" value={target ? value / target : share} color={color} label={label} />
      {!target && totalKcal > 0 && <div className="mt-1 text-[10px] text-ink3">{t('energyShare', { n: Math.round(share * 100) })}</div>}
    </div>
  );
}
