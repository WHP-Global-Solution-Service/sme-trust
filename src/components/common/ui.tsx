import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Inbox, Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Tone } from '@/constants/labels';

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'inverse' | 'inverseOutline';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark disabled:bg-primary/50',
  secondary: 'bg-primary-50 text-primary hover:bg-primary-100',
  outline: 'border border-line bg-white text-ink hover:bg-bg',
  ghost: 'text-primary hover:bg-primary-50',
  danger: 'bg-error text-white hover:bg-error/90 disabled:bg-error/50',
  success: 'bg-success text-white hover:bg-success/90',
  // ใช้บนพื้นหลังสีน้ำเงิน (Hero) — ห้าม override สีผ่าน className เพราะจะชนกับ variant
  inverse: 'bg-white text-primary hover:bg-primary-50',
  inverseOutline: 'border border-white/60 bg-transparent text-white hover:bg-white/10',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon: Icon, loading, block, className, children, disabled, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export function LinkButton({ to, variant = 'primary', size = 'md', icon: Icon, block, className, children }: { to: string; variant?: Variant; size?: Size; icon?: LucideIcon; block?: boolean; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cn('inline-flex items-center justify-center rounded-xl font-medium transition-colors', variants[variant], sizes[size], block && 'w-full', className)}>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </Link>
  );
}

// ---------- Card ----------
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-card border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        <div className="min-w-0">
          <h3 className="font-semibold text-ink">{title}</h3>
          {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ---------- Badge ----------
const toneCls: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  primary: 'bg-primary-50 text-primary border-primary-100',
  success: 'bg-success-50 text-success border-success/20',
  warning: 'bg-warning-50 text-warning border-warning/20',
  error: 'bg-error-50 text-error border-error/20',
  info: 'bg-info-50 text-info border-info/20',
};

export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', toneCls[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StatusBadge<K extends string>({ map, value }: { map: Record<K, { label: string; tone: Tone }>; value: K }) {
  const v = map[value];
  return (
    <Badge tone={v?.tone ?? 'neutral'} dot>
      {v?.label ?? value}
    </Badge>
  );
}

// ---------- Alert ----------
const alertCls: Record<Tone, string> = {
  neutral: 'bg-slate-50 border-slate-200 text-slate-700',
  primary: 'bg-primary-50 border-primary-100 text-primary-dark',
  success: 'bg-success-50 border-success/25 text-success',
  warning: 'bg-warning-50 border-warning/25 text-[#7a4705]',
  error: 'bg-error-50 border-error/25 text-error',
  info: 'bg-info-50 border-info/25 text-[#1d4ab8]',
};

export function Alert({ tone = 'info', icon: Icon, title, children, className, action }: { tone?: Tone; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', alertCls[tone], className)} role={tone === 'error' ? 'alert' : 'status'}>
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// ---------- Empty / Skeleton ----------
export function EmptyState({ icon: Icon = Inbox, title, desc, action }: { icon?: LucideIcon; title: string; desc?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary-50 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <p className="font-semibold text-ink">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm text-ink-soft">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Page header ----------
export function PageHeader({ title, subtitle, back, action, icon: Icon }: { title: ReactNode; subtitle?: ReactNode; back?: { to: string; label?: string }; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-5">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ChevronRight className="h-4 w-4 rotate-180" />
          {back.label ?? 'ย้อนกลับ'}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary sm:grid">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
            value === t.value ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink-soft hover:text-ink',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-xs', value === t.value ? 'bg-white/20' : 'bg-bg')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Stat ----------
/** `th` = ป้ายภาษาไทย (แสดงเป็นหลัก) และ `label` ภาษาอังกฤษแสดงเป็นป้ายรอง */
export function Stat({ label, th, value, icon: Icon, tone = 'primary', hint, to }: { label: string; th?: string; value: ReactNode; icon?: LucideIcon; tone?: Tone; hint?: ReactNode; to?: string }) {
  const body = (
    <Card className={cn('h-full p-4', to && 'transition-colors hover:border-primary/40')}>
      <div className="flex items-start justify-between gap-2">
        {th ? (
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{th}</p>
            <p className="text-xs text-ink-soft">{label}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">{label}</p>
        )}
        {Icon && (
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', toneCls[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

// ---------- Key/value ----------
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-sm text-ink-soft sm:w-44">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

// ---------- List item link ----------
export function ListLink({ to, title, subtitle, right, icon: Icon }: { to: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; icon?: LucideIcon }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg sm:px-5">
      {Icon && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{title}</div>
        {subtitle && <div className="truncate text-sm text-ink-soft">{subtitle}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
    </Link>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-6 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-base font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}
