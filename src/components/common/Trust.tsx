import { QRCodeSVG } from 'qrcode.react';
import { AlertOctagon, BadgeCheck, Clock, ShieldAlert, ShieldCheck, ShieldOff, ShieldQuestion, UserCheck } from 'lucide-react';
import type { Certification, Merchant } from '@/types';
import { CERT_STATUS, DEMO_CERT_LABEL, TRUST_LEVELS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { appUrl } from '@/utils/appUrl';
import type { Verdict, VerdictKey } from '@/utils/trust';
import { Badge } from './ui';

export function Logo({ compact, light }: { compact?: boolean; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('grid h-9 w-9 place-items-center rounded-xl', light ? 'bg-white text-primary' : 'bg-primary text-white')}>
        <ShieldCheck className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className={cn('block text-[15px] font-bold', light ? 'text-white' : 'text-ink')}>SME Trust</span>
          <span className={cn('block text-[11px]', light ? 'text-white/80' : 'text-ink-soft')}>แพลตฟอร์มสาธิต</span>
        </span>
      )}
    </span>
  );
}

export const verifyUrl = (certId: string) => appUrl(`/verify/${certId}`);
export const shopUrl = (merchantId: string) => appUrl(`/shop/${merchantId}`);

const verdictIcon: Record<VerdictKey, typeof ShieldCheck> = {
  certified: BadgeCheck,
  business: ShieldCheck,
  identity: UserCheck,
  pending: Clock,
  unverified: ShieldQuestion,
  expired: Clock,
  suspended: ShieldAlert,
  revoked: ShieldOff,
};

export function VerdictBadge({ verdict, size = 'md' }: { verdict: Verdict; size?: 'sm' | 'md' }) {
  const Icon = verdictIcon[verdict.key];
  return (
    <Badge tone={verdict.tone} className={size === 'md' ? 'px-3 py-1 text-[13px]' : ''}>
      <Icon className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {verdict.label}
    </Badge>
  );
}

/** Verdict Panel สำหรับหน้าตรวจสอบสาธารณะ */
export function VerdictPanel({ verdict }: { verdict: Verdict }) {
  const Icon = verdictIcon[verdict.key];
  const bg = {
    success: 'bg-success-50 border-success/30 text-success',
    primary: 'bg-primary-50 border-primary/20 text-primary',
    info: 'bg-info-50 border-info/25 text-info',
    warning: 'bg-warning-50 border-warning/25 text-warning',
    neutral: 'bg-slate-50 border-slate-200 text-slate-600',
    error: 'bg-error-50 border-error/30 text-error',
  }[verdict.tone];
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border p-4', bg)}>
      <Icon className="h-9 w-9 shrink-0" />
      <div>
        <p className="text-lg font-bold">{verdict.label}</p>
        <p className="text-sm text-ink">{verdict.desc}</p>
        {!verdict.usable && ['suspended', 'revoked', 'expired'].includes(verdict.key) && (
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
            <AlertOctagon className="h-4 w-4" />
            ใบรับรองนี้ไม่สามารถใช้อ้างอิงความน่าเชื่อถือได้ในขณะนี้
          </p>
        )}
        <p className="mt-2 text-xs text-ink-soft">ผลจากระบบสาธิต (Prototype) — ข้อมูลจำลอง ไม่มีผลรับรองหรือผลทางกฎหมายจริง</p>
      </div>
    </div>
  );
}

export function DemoLabel({ className }: { className?: string }) {
  return <p className={cn('text-[11px] font-medium uppercase tracking-wide text-secondary', className)}>{DEMO_CERT_LABEL}</p>;
}

/** Badge ร้านค้า (ใช้ใน Toolkit และหน้าร้าน) */
export function TrustSeal({ level, shopName, usable, small }: { level: number; shopName: string; usable: boolean; small?: boolean }) {
  const info = TRUST_LEVELS[level as keyof typeof TRUST_LEVELS];
  return (
    <div className={cn('inline-flex flex-col items-center rounded-2xl border-2 bg-white text-center', usable ? 'border-primary' : 'border-slate-300 grayscale', small ? 'w-36 p-2.5' : 'w-48 p-4')}>
      <div className={cn('grid place-items-center rounded-full', usable ? 'bg-primary text-white' : 'bg-slate-300 text-white', small ? 'h-10 w-10' : 'h-14 w-14')}>
        {usable ? <ShieldCheck className={small ? 'h-6 w-6' : 'h-8 w-8'} /> : <ShieldOff className={small ? 'h-6 w-6' : 'h-8 w-8'} />}
      </div>
      <p className={cn('mt-1.5 font-bold', usable ? 'text-primary' : 'text-slate-500', small ? 'text-xs' : 'text-sm')}>{usable ? info.name : 'ใช้งานไม่ได้'}</p>
      <p className={cn('line-clamp-1 text-ink', small ? 'text-[10px]' : 'text-xs')}>{shopName}</p>
      <DemoLabel className="mt-1 text-[9px] normal-case" />
    </div>
  );
}

/** หน้าจอใบรับรอง (Certificate) พร้อม QR ชี้ไปยังหน้า Public Verification ภายใน Prototype */
export function CertificateCard({ cert, merchant }: { cert: Certification; merchant: Merchant }) {
  const st = CERT_STATUS[cert.status];
  const level = TRUST_LEVELS[cert.level];
  return (
    <div className={cn('overflow-hidden rounded-2xl border-2 bg-white', st.usable ? 'border-primary/20' : 'border-error/30')}>
      <div className={cn('flex items-center justify-between gap-2 px-5 py-3 text-white', st.usable ? 'bg-primary' : 'bg-slate-500')}>
        <Logo light />
        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs">Certificate (Demo)</span>
      </div>
      {!st.usable && (
        <div className={cn('flex items-center gap-2 px-5 py-2.5 text-sm font-semibold', cert.status === 'expired' ? 'bg-slate-100 text-slate-700' : 'bg-error text-white')} role="status">
          <ShieldOff className="h-5 w-5 shrink-0" />
          ใบรับรองนี้{st.label} — ใช้อ้างอิงความน่าเชื่อถือไม่ได้
        </div>
      )}
      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-3">
          <DemoLabel />
          <div>
            <p className="text-xs text-ink-soft">ชื่อร้านค้า</p>
            <p className="text-lg font-bold text-ink">{merchant.shopName}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-ink-soft">เลขอ้างอิงใบรับรอง</p>
              <p className="font-mono font-semibold">{cert.id}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">ระดับการตรวจสอบ</p>
              <p className="font-semibold">
                Level {cert.level} — {level.name}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">วันที่ออก</p>
              <p>{fmtDate(cert.issuedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">วันหมดอายุ (จำลอง)</p>
              <p>{fmtDate(cert.expiresAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">สถานะปัจจุบัน</span>
            <Badge tone={st.tone} dot>
              {st.label}
            </Badge>
          </div>
          {cert.statusReason && <p className="text-sm text-ink-soft">เหตุผล: {cert.statusReason}</p>}
          <p className="text-xs text-ink-soft">หมายเหตุ: {level.meaningNot}</p>
          <p className="text-xs font-medium text-secondary">ใบรับรองตัวอย่างในระบบสาธิต ไม่มีผลรับรองจริง และไม่ได้ออกโดยสภา SME หรือ สคบ.</p>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className={cn('rounded-xl border border-line p-2', !st.usable && 'opacity-40')}>
            <QRCodeSVG value={verifyUrl(cert.id)} size={128} level="M" fgColor="#112E70" />
          </div>
          <p className="max-w-[140px] text-center text-[11px] text-ink-soft">สแกนเพื่อเปิดหน้าตรวจสอบภายใน Prototype</p>
        </div>
      </div>
    </div>
  );
}
