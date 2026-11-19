import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cx('card p-4', className)} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[20px] font-bold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-[13px] uppercase text-ink3', className)}>{children}</div>;
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'primary', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-mintfill text-mintink',
    secondary: 'bg-[var(--fill)] text-mint',
    ghost: 'bg-transparent text-mint',
    danger: 'bg-[var(--fill)] text-danger',
  };
  return (
    <button
      type="button"
      className={cx('press inline-flex min-h-[50px] items-center justify-center gap-2 whitespace-nowrap rounded-[12px] px-5 text-[17px] font-semibold disabled:opacity-35', styles[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cx('press grid h-11 w-11 place-items-center rounded-full text-mint', className)} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-ink2">
        {label}
      </label>
      {children(id, descId)}
      {(error || hint) && (
        <div id={descId} className={cx('text-[13px]', error ? 'text-danger' : 'text-ink3')} role={error ? 'alert' : undefined}>
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
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-[9px] bg-[var(--fill)] p-[2px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-[32px] flex-1 rounded-[7px] px-2 text-[13px] transition-colors',
            value === o.value ? 'bg-[var(--seg)] font-semibold text-ink shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]' : 'font-medium text-ink',
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
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cx('h-1.5 overflow-hidden rounded-full bg-[var(--fill)]', className)}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {icon && <div className="mb-1 text-ink3 [&_svg]:h-8 [&_svg]:w-8">{icon}</div>}
      <div className="text-[17px] font-semibold text-ink">{title}</div>
      {hint && <p className="max-w-xs text-[15px] leading-snug text-ink2">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'mint' }: { children: ReactNode; tone?: 'mint' | 'gold' | 'muted' | 'warn' | 'danger' }) {
  const tones = {
    mint: 'bg-mintsoft text-mint',
    gold: 'bg-goldsoft text-gold',
    muted: 'bg-[var(--fill)] text-ink2',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/12 text-danger',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', tones[tone])}>{children}</span>;
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
      <div className="anim-fade absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="anim-sheet relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[14px] bg-card outline-none sm:rounded-[14px]"
      >
        <div className="mx-auto mt-[5px] h-[5px] w-9 rounded-full bg-ink3/40 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-tight">
            {title}
          </h2>
          <IconButton label="ปิด / Close" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="px-5 pt-2 pb-[max(env(safe-area-inset-bottom),16px)]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean | 'gold' }) {
  return (
    <div className="card p-3.5">
      <div className="text-[13px] text-ink2">{label}</div>
      <div className={cx('num mt-1 text-[24px] font-semibold leading-tight', accent === 'gold' ? 'text-gold' : accent ? 'text-mint' : 'text-ink')}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink3">{sub}</div>}
    </div>
  );
}
