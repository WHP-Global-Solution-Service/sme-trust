import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Cpu, Info, Sparkles, type LucideIcon } from 'lucide-react';
import { toast } from '@/stores';
import { cn } from '@/utils/cn';

export function AiSimulationBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border border-secondary/30 bg-secondary-50 px-2.5 py-0.5 text-xs font-semibold text-secondary', className)}
      title="วิเคราะห์ด้วยกฎที่กำหนดไว้ล่วงหน้าในเบราว์เซอร์ ไม่ใช่ AI Model จริง"
    >
      <Cpu className="h-3.5 w-3.5" />
      AI Simulation
    </span>
  );
}

/** คำกำกับที่ต้องแสดงทุกหน้าที่เกี่ยวข้องกับ AI Simulation */
export function AiDisclaimer({ compact }: { compact?: boolean }) {
  return (
    <div className="flex gap-2 rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink-soft" role="note">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
      <p>
        <b className="text-ink">AI Simulation — ไม่ใช่ AI Model จริง</b> ระบบวิเคราะห์ด้วยกฎ (Rule-based) ที่กำหนดไว้ล่วงหน้าและทำงานในเบราว์เซอร์เท่านั้น ไม่ส่งข้อความไปยังระบบภายนอก
        {!compact && ' ผลการวิเคราะห์เป็นคำแนะนำเบื้องต้นสำหรับการสาธิต ไม่ใช่คำวินิจฉัยทางกฎหมาย ไม่ใช่การอนุมัติข้อความ และไม่ตัดสิทธิ์ผู้บริโภคในการร้องเรียน'}
      </p>
    </div>
  );
}

export function AiHeader({ icon: Icon = Sparkles, title, desc, back }: { icon?: LucideIcon; title: string; desc: string; back?: { to: string; label: string } }) {
  return (
    <div className="mb-4">
      {back && (
        <Link to={back.to} className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ChevronRight className="h-4 w-4 rotate-180" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-ink sm:text-2xl">{title}</h1>
            <AiSimulationBadge />
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export function AiServiceCard({ to, icon: Icon, title, desc, cta, compact }: { to: string; icon: LucideIcon; title: string; desc: string; cta: string; compact?: boolean }) {
  return (
    <Link to={to} className="group flex h-full items-start gap-3 rounded-card border border-line bg-white p-4 shadow-card transition-colors hover:border-primary/40">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {!compact && <span className="mt-0.5 block text-sm text-ink-soft">{desc}</span>}
        <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary">
          {cta}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

export function SectionCard({ title, icon: Icon, children, action, className }: { title: ReactNode; icon?: LucideIcon; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-card border border-line bg-white shadow-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-ink">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** คัดลอกข้อความด้วย Clipboard API (มี Fallback สำหรับเบราว์เซอร์ที่ไม่อนุญาต) */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ไปใช้ Fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyWithToast(text: string, what = 'ข้อความ') {
  const ok = await copyText(text);
  if (ok) toast.success(`คัดลอก${what}แล้ว`);
  else toast.error('คัดลอกไม่สำเร็จ', 'กรุณาเลือกข้อความแล้วคัดลอกด้วยตนเอง');
}
