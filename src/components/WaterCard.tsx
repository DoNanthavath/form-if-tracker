import { Droplet, Minus } from 'lucide-react';
import { useApp } from '../app/context';
import { useWaterSince } from '../hooks/data';
import { addWater, deleteWater } from '../db/repo';
import { Button, ProgressBar } from './ui';
import { useToast } from './Toast';

export function WaterCard() {
  const { t, today, settings, fmtNum } = useApp();
  const entries = useWaterSince(1, today);
  const toast = useToast();
  const total = entries.reduce((a, e) => a + e.ml, 0);
  const target = settings.waterTargetMl;
  const last = [...entries].sort((a, b) => b.at - a.at)[0];
  const glasses = Math.min(10, Math.ceil(target / 250));
  const filled = Math.floor(total / 250);
  const add = async (ml: number) => {
    const e = await addWater(today, ml);
    toast(`+${ml} ${t('ml')}`, { label: t('undo'), run: () => deleteWater(e.id) });
  };
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <div className="num text-[26px] font-semibold leading-none">
            {fmtNum(total / 1000, 2)} <span className="text-[14px] text-ink3">/ {fmtNum(target / 1000, 1)} L</span>
          </div>
        </div>
        {last && (
          <button type="button" className="press flex items-center gap-1 rounded-xl px-2 py-1.5 text-[12px] text-ink3 hover:text-ink" onClick={() => deleteWater(last.id)} aria-label={`${t('undo')} ${last.ml} ${t('ml')}`}>
            <Minus size={14} /> {last.ml}
          </button>
        )}
      </div>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: glasses }, (_, i) => (
          <div key={i} className={`h-7 flex-1 rounded-md transition-colors ${i < filled ? 'bg-water' : 'bg-[var(--track)]'}`} />
        ))}
      </div>
      <ProgressBar className="sr-only" value={total / target} label={t('waterToday')} color="var(--water)" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[250, 500, 750].map((ml) => (
          <Button key={ml} variant="secondary" className="!min-h-[42px] !px-2 text-[14px]" onClick={() => add(ml)}>
            <Droplet size={15} className="text-water" />+{ml}
          </Button>
        ))}
      </div>
    </div>
  );
}
