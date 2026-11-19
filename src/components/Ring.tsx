import type { ReactNode } from 'react';

/** Circular progress ring with a gradient stroke and an optional child in the middle. */
export function Ring({
  value, size = 280, stroke = 22, children, label, color = 'var(--mint)', color2 = 'var(--mintfill)', track = 'var(--track)', id = 'ring',
}: {
  value: number; size?: number; stroke?: number; children?: ReactNode; label: string; color?: string; color2?: string; track?: string; id?: string;
}) {
  const v = Math.max(0, Math.min(1, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size, maxWidth: '100%', aspectRatio: '1' }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color2} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id}-g)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Small ring used for weekday indicators. */
export function MiniRing({ value, size = 40, children, active, label }: { value: number; size?: number; children: ReactNode; active?: boolean; label: string }) {
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={v >= 1 ? 'var(--gold)' : 'var(--mint)'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />}
      </svg>
      <div className={`absolute inset-0 grid place-items-center text-[12px] ${active ? 'font-bold text-ink' : v >= 1 ? 'font-semibold text-gold' : 'text-ink2'}`}>{children}</div>
    </div>
  );
}
