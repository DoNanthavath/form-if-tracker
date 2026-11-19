import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-3 pb-1">
      <div>
        {subtitle && <div className="text-[13px] font-semibold uppercase text-ink3">{subtitle}</div>}
        <h1 className="text-[34px] leading-[41px] font-bold tracking-[0.01em]">{title}</h1>
      </div>
      {action}
    </header>
  );
}
