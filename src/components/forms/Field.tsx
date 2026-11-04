import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export function Field({ label, error, hint, required, children, className, extra }: { label: string; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode; className?: string; extra?: ReactNode }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
        <span>
          {label}
          {required && <span className="ml-0.5 text-secondary">*</span>}
        </span>
        {extra}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-xs text-error" role="alert">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </span>
      )}
    </label>
  );
}

const base =
  'w-full rounded-xl border bg-white px-3.5 text-[15px] text-ink placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-bg';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...rest }, ref) => (
  <input ref={ref} className={cn(base, 'h-11', invalid ? 'border-error' : 'border-line', className)} {...rest} />
));
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, children, ...rest }, ref) => (
  <select ref={ref} className={cn(base, 'h-11 pr-8', invalid ? 'border-error' : 'border-line', className)} {...rest}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...rest }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-[96px] py-2.5', invalid ? 'border-error' : 'border-line', className)} {...rest} />
));
Textarea.displayName = 'Textarea';

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'ค้นหา'} className="pl-9" type="search" />
    </div>
  );
}
