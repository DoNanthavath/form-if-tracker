import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pt-2">
      <div>
        {subtitle && <div className="text-[13px] text-ink3">{subtitle}</div>}
        <h1 className="text-[30px] font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
