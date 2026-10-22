import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FlaskConical, Info, X, XCircle } from 'lucide-react';
import { useUiStore } from '@/stores/ui';
import { cn } from '@/utils/cn';
import { Button } from '@/components/common/ui';
import { Modal } from '@/components/common/Modal';
import { Field, Textarea } from '@/components/forms/Field';
import { PROTOTYPE_LABEL } from '@/constants/labels';

export function PrototypeBanner() {
  return (
    <div className="h-7 truncate bg-secondary px-4 text-center text-xs font-medium leading-7 text-white">
      <FlaskConical className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
      {PROTOTYPE_LABEL}
      <span className="hidden sm:inline"> — ข้อมูลทั้งหมดเป็นข้อมูลจำลอง ไม่ใช่ระบบของหน่วยงานรัฐที่ใช้งานจริง</span>
      <span className="sm:hidden"> — ข้อมูลจำลองทั้งหมด</span>
    </div>
  );
}

const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const toneCls = {
  success: 'border-success/30 text-success',
  error: 'border-error/30 text-error',
  info: 'border-info/30 text-info',
  warning: 'border-warning/30 text-warning',
};

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-12 z-[70] flex flex-col items-center gap-2 px-4 sm:left-auto sm:right-4 sm:items-end" aria-live="polite">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div key={t.id} className={cn('pointer-events-auto flex w-full max-w-sm animate-slideUp items-start gap-3 rounded-xl border bg-white p-3.5 shadow-pop', toneCls[t.tone])}>
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-ink-soft">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-ink-soft hover:text-ink" aria-label="ปิดการแจ้งเตือน">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ConfirmHost() {
  const c = useUiStore((s) => s.confirm);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  if (!c) return null;
  const close = (ok: boolean) => {
    if (ok && c.reasonLabel && reason.trim().length < 5) {
      setErr('กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร');
      return;
    }
    c.resolve({ ok, reason: reason.trim() });
    setReason('');
    setErr('');
  };
  return (
    <Modal
      open
      onClose={() => close(false)}
      title={c.title}
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            ยกเลิก
          </Button>
          <Button variant={c.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)}>
            {c.confirmText ?? 'ยืนยัน'}
          </Button>
        </>
      }
    >
      {c.body && <p className="text-sm text-ink-soft">{c.body}</p>}
      {c.reasonLabel && (
        <Field label={c.reasonLabel} required error={err} className="mt-3">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!err} autoFocus />
        </Field>
      )}
    </Modal>
  );
}
