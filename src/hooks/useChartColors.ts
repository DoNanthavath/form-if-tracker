import { useMemo } from 'react';
import { useApp } from '../app/context';

/** Resolved CSS colour tokens for SVG chart attributes (which can't use var()). */
export function useChartColors() {
  const { dark } = useApp();
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    return { mint: v('--mint'), mint2: v('--mint2'), ink2: v('--ink2'), ink3: v('--ink3'), line: v('--line'), card: v('--card'), protein: v('--protein'), carbs: v('--carbs'), fat: v('--fat'), water: v('--water'), danger: v('--danger'), track: v('--track') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);
}
