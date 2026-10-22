import { Eraser, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';

/** ช่องกรอกข้อความ + ตัวนับ + ตัวอย่าง + ปุ่มวิเคราะห์ (ใช้ร่วมกันทั้ง 2 ระบบ) */
export function AnalysisInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  examples,
  activeExample,
  onExample,
  onAnalyze,
  onClear,
  loading,
  error,
  analyzeLabel,
  stale,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  max: number;
  examples: { id: string; title: string }[];
  activeExample?: string;
  onExample: (id: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  loading: boolean;
  error?: string;
  analyzeLabel: string;
  stale?: boolean;
}) {
  const over = value.length > max;
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">ตัวอย่างสำหรับทดลอง</p>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {examples.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={loading}
              onClick={() => onExample(e.id)}
              className={cn(
                'h-9 shrink-0 rounded-full border px-3 text-sm transition-colors disabled:opacity-50',
                activeExample === e.id ? 'border-primary bg-primary text-white' : 'border-line bg-white text-ink hover:border-primary/40',
              )}
            >
              {e.title}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          disabled={loading}
          aria-invalid={!!error || over}
          className={cn(
            'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-bg',
            error || over ? 'border-error' : 'border-line',
          )}
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <span className={error ? 'text-error' : stale ? 'text-warning' : 'text-ink-soft'} role={error ? 'alert' : undefined}>
            {error ?? (stale ? 'ข้อความถูกแก้ไขหลังการวิเคราะห์ — กดวิเคราะห์อีกครั้งเพื่ออัปเดตผล' : 'รองรับภาษาไทยและภาษาอังกฤษ')}
          </span>
          <span className={cn('shrink-0 tabular-nums', over ? 'font-semibold text-error' : 'text-ink-soft')}>
            {value.length.toLocaleString()}/{max.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" icon={loading ? undefined : Sparkles} loading={loading} onClick={onAnalyze} disabled={loading} className="sm:flex-1">
          {loading ? 'กำลังวิเคราะห์ตามกฎ…' : analyzeLabel}
        </Button>
        <Button size="lg" variant="outline" icon={Eraser} onClick={onClear} disabled={loading || !value}>
          ล้างข้อความ
        </Button>
      </div>
      {loading && (
        <p className="flex items-center gap-1.5 text-xs text-ink-soft" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          จำลองการประมวลผลในเบราว์เซอร์ (ไม่มีการส่งข้อมูลออกนอกเครื่อง)
        </p>
      )}
    </div>
  );
}
