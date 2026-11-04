import { useState } from 'react';
import { Eye, Store } from 'lucide-react';
import type { Merchant } from '@/types';
import { useMarketplaceStore } from '@/stores';
import { reportDemo } from '@/stores/demo';
import { Badge, Button, Card, CardHeader } from '@/components/common/ui';
import { Modal } from '@/components/common/Modal';
import { fmtDate } from '@/utils/format';
import { usableConnections } from '@/features/trust-assessment/inputs';
import type { MarketplaceConnection } from '../types';
import { MARKETPLACE_DISCLAIMER, PLATFORMS } from '../data/platforms';
import { snapshotOf } from '../services/generator';
import { StorePreview } from './SnapshotSummary';

/**
 * ร้านบน Marketplace (จำลอง) ที่ร้านเชื่อมต่อข้อมูลแล้ว — มุมผู้บริโภค
 * แสดงเฉพาะข้อมูลระดับร้าน ไม่มีข้อมูลเจ้าของร้านหรือผู้ซื้อ และไม่เปิดเว็บไซต์ภายนอก
 */
export function PublicMarketplaceChannels({ merchant }: { merchant: Merchant }) {
  const all = useMarketplaceStore((s) => s.items);
  const conns = usableConnections(all, merchant.id);
  const [open, setOpen] = useState<MarketplaceConnection>();
  if (!conns.length) return null;
  return (
    <Card>
      <CardHeader title="ร้านบน Marketplace ที่เชื่อมต่อข้อมูลแล้ว" subtitle="ร้านยืนยันความเป็นเจ้าของผ่านการให้ความยินยอม (จำลอง)" icon={Store} />
      <ul className="space-y-2 p-4 sm:p-5">
        {conns.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{PLATFORMS[c.platform].label}</p>
              <p className="truncate text-xs text-ink-soft">
                Shop ID จำลอง {c.mockShopId} · อัปเดต {c.lastSyncAt ? fmtDate(c.lastSyncAt) : '—'}
              </p>
            </div>
            <Badge tone="success">เชื่อมต่อข้อมูลแล้ว</Badge>
            <Button
              size="sm"
              variant="outline"
              icon={Eye}
              onClick={() => {
                setOpen(c);
                reportDemo('marketplace.preview', true);
              }}
            >
              ดูตัวอย่างหน้าร้าน
            </Button>
          </li>
        ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpen(undefined)} title="ตัวอย่างหน้าร้านบน Marketplace (จำลอง)" footer={<Button onClick={() => setOpen(undefined)}>เข้าใจแล้ว</Button>} wide>
        {open && (
          <div className="space-y-3 text-sm">
            <StorePreview connection={open} snap={snapshotOf(open, merchant.category)} shopName={merchant.shopName} />
            <p className="text-ink-soft">ระบบสาธิตไม่พาคุณไปยังเว็บไซต์หรือร้านจริง — {MARKETPLACE_DISCLAIMER}</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
