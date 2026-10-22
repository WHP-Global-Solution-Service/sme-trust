import { useEffect, useRef } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import { cn } from '@/utils/cn';

export function PinDots({ length, filled, error }: { length: number; filled: number; error?: boolean }) {
  return (
    <div className={cn('flex justify-center gap-3', error && 'animate-[shake_.3s]')} aria-label={`กรอกแล้ว ${filled} จาก ${length} หลัก`}>
      {Array.from({ length }).map((_, i) => (
        <span key={i} className={cn('h-3.5 w-3.5 rounded-full border-2 transition-colors', error ? 'border-error bg-error' : i < filled ? 'border-primary bg-primary' : 'border-primary/30')} />
      ))}
    </div>
  );
}

/** Keypad 6 หลัก — รองรับทั้งการแตะและคีย์บอร์ด */
export function PinPad({ value, onChange, length = 6, onBiometric }: { value: string; onChange: (v: string) => void; length?: number; onBiometric?: () => void }) {
  const ref = useRef(value);
  ref.current = value;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key) && ref.current.length < length) onChange(ref.current + e.key);
      if (e.key === 'Backspace') onChange(ref.current.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [length, onChange]);

  const key = 'grid h-16 place-items-center rounded-2xl text-2xl font-semibold text-ink transition-colors active:bg-primary-100 hover:bg-primary-50';
  return (
    <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
        <button key={n} type="button" className={key} onClick={() => value.length < length && onChange(value + n)}>
          {n}
        </button>
      ))}
      {onBiometric ? (
        <button type="button" className={cn(key, 'text-primary')} onClick={onBiometric} aria-label="เข้าสู่ระบบด้วยชีวมิติ (จำลอง)">
          <Fingerprint className="h-7 w-7" />
        </button>
      ) : (
        <span />
      )}
      <button type="button" className={key} onClick={() => value.length < length && onChange(value + '0')}>
        0
      </button>
      <button type="button" className={cn(key, 'text-ink-soft')} onClick={() => onChange(value.slice(0, -1))} aria-label="ลบตัวเลข">
        <Delete className="h-6 w-6" />
      </button>
    </div>
  );
}

/** ช่องกรอก OTP 6 หลัก */
export function OtpInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="absolute inset-0 h-full w-full opacity-0"
        aria-label="รหัส OTP 6 หลัก"
      />
      <div className="flex justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'grid h-12 w-10 place-items-center rounded-xl border-2 text-xl font-semibold sm:h-14 sm:w-12',
              invalid ? 'border-error text-error' : i === value.length ? 'border-primary' : 'border-line',
            )}
          >
            {value[i] ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
