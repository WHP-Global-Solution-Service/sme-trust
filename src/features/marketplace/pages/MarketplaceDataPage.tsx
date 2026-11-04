import { useParams } from 'react-router-dom';
import { BarChart3, Database, Link2 } from 'lucide-react';
import { useMarketplaceStore } from '@/stores';
import { useMyMerchants } from '@/hooks/useCurrent';
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';
import { PLATFORMS } from '../data/platforms';
import { snapshotOf } from '../services/generator';
import { CONNECTION_STATUS, MarketplaceDisclaimer } from '../components/MarketplaceParts';
import { FreshnessCard } from '../components/FreshnessCard';
import { AvailabilityList, ListingTable, SnapshotMetrics, SourceLine } from '../components/SnapshotSummary';

/** Marketplace Data Overview — ข้อมูลที่นำเข้าจากการเชื่อมต่อหนึ่งรายการ (ร้านค้าเห็นข้อมูลของตัวเองเท่านั้น) */
export default function MarketplaceDataPage() {
  const { id } = useParams();
  const { mine } = useMyMerchants();
  const c = useMarketplaceStore((s) => s.items.find((x) => x.id === id));
  const m = mine.find((x) => x.id === c?.merchantId);

  if (!c || !m)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="ข้อมูล Marketplace (จำลอง)" back={{ to: '/m/marketplace', label: 'Marketplace Connection' }} />
        <EmptyState title="ไม่พบการเชื่อมต่อนี้" desc="การเชื่อมต่ออาจถูกยกเลิก หรือไม่ใช่ร้านของบัญชีนี้" action={<LinkButton to="/m/marketplace">กลับไปหน้าการเชื่อมต่อ</LinkButton>} />
      </div>
    );

  const ready = c.status === 'connected' && !!c.lastSyncAt;
  const snap = ready ? snapshotOf(c, m.category) : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Marketplace Data Overview"
        subtitle={`${m.shopName} · ${PLATFORMS[c.platform].label}`}
        icon={Database}
        back={{ to: '/m/marketplace', label: 'Marketplace Connection' }}
        action={
          ready ? (
            <LinkButton to="/m/marketplace/analysis" icon={BarChart3}>
              วิเคราะห์ข้อมูลการขาย
            </LinkButton>
          ) : undefined
        }
      />
      <MarketplaceDisclaimer />
      <Card>
        <CardHeader title="สถานะการเชื่อมต่อ" icon={Link2} action={<StatusBadge map={CONNECTION_STATUS} value={c.status} />} />
        <dl className="grid gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-soft">ชื่อร้านบนแพลตฟอร์ม</dt>
            <dd className="text-ink">{c.mockShopName}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Shop ID จำลอง</dt>
            <dd className="font-mono text-ink">{c.mockShopId}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Data Source</dt>
            <dd className="text-ink">
              {PLATFORMS[c.platform].label} · {c.id}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">วันที่ข้อมูลอัปเดต</dt>
            <dd className="text-ink">{c.lastSyncAt ? fmtDate(c.lastSyncAt, true) : 'ยังไม่ได้ซิงก์'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-soft">ขอบเขตที่ร้านให้ความยินยอม</dt>
            <dd className="text-ink">{c.scopes.length ? c.scopes.join(' · ') : '—'}</dd>
          </div>
        </dl>
      </Card>
      {c.status !== 'pending_consent' && c.status !== 'disconnected' && <FreshnessCard connection={c} />}
      {snap ? (
        <>
          <Card>
            <CardHeader title="ข้อมูลร้านที่นำเข้า" subtitle="ข้อมูลระดับร้านค้า — ไม่มีข้อมูลผู้ซื้อ" />
            <div className="space-y-3 p-4">
              <SnapshotMetrics snap={snap} category={m.category} />
              <ListingTable snap={snap} />
              <SourceLine connection={c} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Data Availability" subtitle="ข้อมูลที่มีและไม่มีจากแหล่งนี้ — ข้อมูลที่ไม่มีไม่ถูกนับเป็นศูนย์" />
            <div className="p-4">
              <AvailabilityList snap={snap} />
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState title="ยังไม่มีข้อมูลที่ซิงก์สำเร็จ" desc={c.failReason ?? 'รอการซิงก์ หรือให้ความยินยอมที่หน้าการเชื่อมต่อ'} action={<LinkButton to="/m/marketplace">ไปที่หน้าการเชื่อมต่อ</LinkButton>} />
        </Card>
      )}
    </div>
  );
}
