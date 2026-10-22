import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Progress Indicator สำหรับ Wizard — แสดงแบบย่อบนมือถือ */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const pct = Math.round(((current + 1) / steps.length) * 100);
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">
          ขั้นตอนที่ {current + 1}/{steps.length}: {steps[current]}
        </span>
        <span className="text-ink-soft">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-primary-50" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 hidden gap-1 md:flex">
        {steps.map((s, i) => (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                i < current ? 'bg-success text-white' : i === current ? 'bg-primary text-white' : 'bg-white text-ink-soft ring-1 ring-line',
              )}
            >
              {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn('truncate text-xs', i === current ? 'font-medium text-ink' : 'text-ink-soft')}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
