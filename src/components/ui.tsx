import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cx('card p-5', className)} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] text-ink3', className)}>{children}</div>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-mintfill text-mintink shadow-[0_8px_30px_-10px_var(--mintfill)] hover:brightness-110',
    secondary: 'bg-card2 text-ink border border-line hover:border-mint/40',
    ghost: 'bg-transparent text-ink2 hover:text-ink',
    danger: 'bg-danger/12 text-danger border border-danger/25',
  };
  return (
    <button
      type="button"
      className={cx('press inline-flex min-h-[46px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 text-[15px] font-semibold disabled:opacity-40', styles[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('press grid h-11 w-11 place-items-center rounded-full text-ink2 hover:text-ink hover:bg-card2', className)} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink2">
        {label}
      </label>
      {children(id, descId)}
      {(error || hint) && (
        <div id={descId} className={cx('text-xs', error ? 'text-danger' : 'text-ink3')} role={error ? 'alert' : undefined}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

export function TextInput({ label, hint, error, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => <input id={id} aria-describedby={d} aria-invalid={!!error} className="field" {...rest} />}
    </Field>
  );
}

export function Select<V extends string>({ label, value, onChange, options, hint }: { label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <select id={id} aria-describedby={d} className="field appearance-none" value={value} onChange={(e) => onChange(e.target.value as V)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Segmented<V extends string>({ value, onChange, options, label, className }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-2xl border border-line bg-bg2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'press min-h-[38px] flex-1 rounded-xl px-2 text-[13px] font-semibold transition-colors',
            value === o.value ? 'bg-mintfill text-mintink shadow' : 'text-ink2 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, color = 'var(--mint)', label, className }: { value: number; color?: string; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cx('h-2 overflow-hidden rounded-full bg-[var(--track)]', className)}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-mintsoft text-mint">{icon}</div>}
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      {hint && <p className="max-w-xs text-[13px] leading-relaxed text-ink3">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'mint' }: { children: ReactNode; tone?: 'mint' | 'gold' | 'muted' | 'warn' | 'danger' }) {
  const tones = {
    mint: 'bg-mintsoft text-mint',
    gold: 'bg-goldsoft text-gold',
    muted: 'bg-card2 text-ink2 border border-line',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/12 text-danger',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>;
}

/** Bottom sheet on mobile, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])');
        const list = [...f].filter((el) => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => ref.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  // Portal to <body>: animated/transformed ancestors would otherwise trap position:fixed.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="anim-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="anim-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] border border-line bg-card outline-none sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
          <h2 id={titleId} className="text-[17px] font-semibold">
            {title}
          </h2>
          <IconButton label="ปิด / Close" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean | 'gold' }) {
  return (
    <div className="rounded-2xl border border-line bg-bg2/60 p-3.5">
      <div className="text-[12px] text-ink3">{label}</div>
      <div className={cx('num mt-1 text-[22px] font-semibold leading-tight', accent === 'gold' ? 'text-gold' : accent ? 'text-mint' : 'text-ink')}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink3">{sub}</div>}
    </div>
  );
}
