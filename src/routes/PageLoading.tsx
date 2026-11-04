import { Loader2 } from 'lucide-react';

/** ระหว่างโหลดหน้าที่แยกไฟล์ (ครั้งแรกเท่านั้น) */
export function PageLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-ink-soft" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      กำลังโหลดหน้า…
    </div>
  );
}
