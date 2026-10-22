import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Info, MapPin, Store } from 'lucide-react';
import type { SalesChannel } from '@/types';
import { useCertificationStore, useMerchantStore, useOperatorStore } from '@/stores';
import { CHANNEL_STATUS, CHANNEL_TYPES } from '@/constants/labels';
import { currentCert, effectiveLevel, isPublicMerchant, verdictFor, type VerdictKey } from '@/utils/trust';
import { Alert, Badge, Button, Card, StatusBadge } from '@/components/common/ui';
import { Modal } from '@/components/common/Modal';
import { TrustSeal, VerdictBadge } from '@/components/common/Trust';
import { reportDemo } from '@/stores/demo';

export function usePublicMerchants() {
  const merchants = useMerchantStore((s) => s.items);
  const ops = useOperatorStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);
  return useMemo(
    () =>
      merchants.filter(isPublicMerchant).map((m) => {
        const op = ops.find((o) => o.id === m.operatorId);
        const cert = currentCert(certs, m.id);
        return { merchant: m, cert, verdict: verdictFor(m, op, cert), level: effectiveLevel(op, cert) };
      }),
    [merchants, ops, certs],
  );
}

export type PublicMerchant = ReturnType<typeof usePublicMerchants>[number];

export const VERDICT_FILTERS: { value: VerdictKey | ''; label: string }[] = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'certified', label: 'ได้รับการรับรอง' },
  { value: 'business', label: 'ผ่านเกณฑ์ธุรกิจ' },
  { value: 'identity', label: 'ยืนยันตัวตนแล้ว' },
  { value: 'pending', label: 'อยู่ระหว่างยื่นคำขอ' },
  { value: 'expired', label: 'ใบรับรองหมดอายุ' },
  { value: 'suspended', label: 'ถูกระงับการรับรอง' },
  { value: 'revoked', label: 'ถูกเพิกถอนการรับรอง' },
];

export function filterMerchants(list: PublicMerchant[], f: { q: string; category: string; province: string; status: string }) {
  const q = f.q.trim().toLowerCase();
  return list.filter(
    (x) =>
      (!q || x.merchant.shopName.toLowerCase().includes(q) || x.merchant.category.includes(q) || x.merchant.channels.some((c) => c.handle.toLowerCase().includes(q))) &&
      (!f.category || x.merchant.category === f.category) &&
      (!f.province || x.merchant.province === f.province) &&
      (!f.status || x.verdict.key === f.status),
  );
}

export function MerchantCard({ x }: { x: PublicMerchant }) {
  const m = x.merchant;
  const verified = m.channels.filter((c) => c.status === 'verified').length;
  return (
    <Link to={`/shop/${m.id}`} className="block">
      <Card className="h-full p-4 transition-colors hover:border-primary/40">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-50 text-lg font-bold text-primary">{m.shopName.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{m.shopName}</p>
            <p className="truncate text-sm text-ink-soft">{m.category}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
              <MapPin className="h-3.5 w-3.5" />
              {m.province}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={x.verdict} size="sm" />
          <Badge tone="neutral">ช่องทางที่ตรวจแล้ว {verified}/{m.channels.length}</Badge>
        </div>
      </Card>
    </Link>
  );
}

export function NotFoundExplain({ query }: { query?: string }) {
  return (
    <Card className="p-5 text-center">
      <Store className="mx-auto h-10 w-10 text-ink-soft" />
      <p className="mt-2 font-semibold text-ink">ไม่พบข้อมูล{query ? ` "${query}"` : ''}</p>
      <Alert tone="info" icon={Info} className="mt-3 text-left">
        <b>"ไม่พบข้อมูล" ไม่ได้หมายความว่าร้านค้านั้นกระทำผิด</b> ร้านค้าอาจยังไม่ได้ลงทะเบียนกับระบบ หรือใช้ชื่ออื่น ควรตรวจสอบข้อมูลผู้ขาย ช่องทางติดต่อ และเงื่อนไขการขายก่อนตัดสินใจซื้อ
      </Alert>
    </Card>
  );
}

/** ปุ่มเปิดช่องทางขายเดิม — ใช้ลิงก์จำลองที่ปลอดภัย ไม่พาผู้ใช้ออกไปยังเว็บไซต์ภายนอก */
export function ChannelButtons({ channels, shopName, certId, usable, level = 0 }: { channels: SalesChannel[]; shopName?: string; certId?: string; usable?: boolean; level?: number }) {
  const [open, setOpen] = useState<SalesChannel>();
  const openPreview = (c: SalesChannel) => {
    setOpen(c);
    reportDemo('channel.preview', true);
  };
  return (
    <>
      <ul className="space-y-2">
        {channels.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line p-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{CHANNEL_TYPES[c.type].label}</p>
              <p className="truncate text-xs text-ink-soft">{c.handle}</p>
            </div>
            <StatusBadge map={CHANNEL_STATUS} value={c.status} />
            <Button size="sm" variant="outline" icon={ExternalLink} onClick={() => openPreview(c)}>
              เปิด
            </Button>
          </li>
        ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpen(undefined)} title="เปิดช่องทางขาย (ลิงก์จำลอง)" footer={<Button onClick={() => setOpen(undefined)}>เข้าใจแล้ว</Button>}>
        {open && (
          <div className="space-y-3 text-sm">
            <p>
              ช่องทาง: <b>{CHANNEL_TYPES[open.type].label}</b>
            </p>
            <p className="rounded-lg bg-bg px-3 py-2 font-mono">
              {CHANNEL_TYPES[open.type].prefix}
              {open.handle}
            </p>
            <Alert tone={open.status === 'verified' ? 'success' : 'warning'}>
              {open.status === 'verified'
                ? 'ช่องทางนี้ผ่านการตรวจสอบความเป็นเจ้าของในระบบสาธิตแล้ว'
                : 'ช่องทางนี้ยังไม่ผ่านการตรวจสอบ ควรระวังบัญชีที่แอบอ้างชื่อร้าน'}
            </Alert>
            {shopName && (
              <div className="overflow-hidden rounded-xl border border-line" aria-label="ตัวอย่างหน้าร้านบนแพลตฟอร์ม (Mockup)">
                <p className="bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-ink-soft">ตัวอย่างหน้าร้านบน {CHANNEL_TYPES[open.type].label} — Mockup ภายในแอป (ไม่ใช่หน้าจริง)</p>
                <div className="flex items-center gap-3 p-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-50 text-lg font-bold text-primary">{shopName.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{shopName}</p>
                    <p className="truncate text-xs text-ink-soft">@{open.handle}</p>
                  </div>
                  {usable && open.status === 'verified' && <TrustSeal level={level} shopName={shopName} usable small />}
                </div>
                {certId && (
                  <p className="border-t border-line px-3 py-2 text-xs text-ink">
                    ตรวจสอบร้านนี้ได้ที่ <span className="font-mono text-primary">…/verify/{certId}</span>
                  </p>
                )}
                {usable && open.status !== 'verified' && <p className="border-t border-line bg-warning-50 px-3 py-2 text-xs text-[#7a4705]">ช่องทางนี้ยังไม่ผ่านการตรวจสอบ — Badge ที่แสดงบนช่องทางนี้ควรถูกตรวจสอบกับหน้าตรวจสอบของระบบ</p>}
              </div>
            )}
            <p className="text-ink-soft">ระบบสาธิตจะไม่พาคุณไปยังเว็บไซต์หรือบัญชีจริง เพื่อป้องกันความเข้าใจผิดว่าร้านค้าจริงได้รับการรับรอง</p>
          </div>
        )}
      </Modal>
    </>
  );
}
