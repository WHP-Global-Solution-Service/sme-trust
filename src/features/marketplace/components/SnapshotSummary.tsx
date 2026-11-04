import { CheckCircle2, MinusCircle, Package, Star } from 'lucide-react';
import type { MarketplaceConnection, MarketplaceSnapshot } from '../types';
import { PLATFORMS } from '../data/platforms';
import { PRODUCT_RISK_LABEL } from '../data/catalog';
import { Badge } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';

const n = (x: number) => x.toLocaleString('th-TH');
const baht = (x: number) => `${n(Math.round(x))} บาท`;

/** ตัวเลขสรุปของข้อมูลร้านบนแพลตฟอร์มหนึ่ง (คำนวณจาก Snapshot เดียวกับที่ Engine ใช้) */
export function snapshotStats(s: MarketplaceSnapshot) {
  const prices = s.listings.map((l) => l.price);
  const rating = s.totalReviews ? s.ratingHistogram.reduce((a, c, i) => a + c * (i + 1), 0) / s.totalReviews : 0;
  return {
    products: s.listings.length,
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    rating,
    reviews: s.totalReviews,
    orders: s.monthlyOrders.reduce((a, b) => a + b, 0),
    months: s.monthlyOrders.filter((m) => m > 0).length,
    shopAge: s.shopAgeMonths,
  };
}

/** ข้อมูลที่มี/ไม่มีจากแหล่งนี้ (Data Availability) */
export function dataAvailability(s: MarketplaceSnapshot) {
  const st = snapshotStats(s);
  return [
    { label: 'ข้อมูลร้าน (ชื่อ อายุร้าน หมวดสินค้า)', ok: true, note: `อายุร้าน ${st.shopAge} เดือน` },
    { label: 'รายการสินค้าและราคา', ok: st.products > 0, note: `${st.products} รายการ · ประวัติราคา 6 เดือน` },
    { label: 'คำสั่งซื้อรายเดือน', ok: st.months > 0, note: `มีข้อมูล ${st.months}/12 เดือน` },
    { label: 'การยกเลิก คืนสินค้า และการจัดส่ง', ok: true, note: 'อัตราเฉลี่ย 12 เดือน' },
    { label: 'คะแนนและรีวิว', ok: st.reviews > 0, note: `${n(st.reviews)} รีวิว · ข้อความตัวอย่าง ${s.reviews.length} รายการ` },
    { label: 'ข้อมูลผู้ซื้อ', ok: false, note: 'ไม่ขอเข้าถึง — ปกป้องข้อมูลส่วนบุคคล' },
    { label: 'ยอดขายนอกแพลตฟอร์มนี้', ok: false, note: 'ไม่อยู่ในแหล่งข้อมูลนี้' },
  ];
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-bg p-2.5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

/** ตัวเลขหลักของร้าน — ใช้ทั้ง Preview ก่อนนำเข้า และ Marketplace Data Overview */
export function SnapshotMetrics({ snap, category }: { snap: MarketplaceSnapshot; category: string }) {
  const st = snapshotStats(snap);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Metric label="หมวดสินค้า" value={category} />
      <Metric label="จำนวนสินค้า" value={`${st.products} รายการ`} />
      <Metric label="ช่วงราคา" value={st.products ? `${n(st.priceMin)}–${n(st.priceMax)} บาท` : '—'} />
      <Metric label="คะแนนร้าน" value={st.reviews ? `${st.rating.toFixed(2)} ดาว` : 'ยังไม่มีรีวิว'} />
      <Metric label="จำนวนรีวิว" value={n(st.reviews)} />
      <Metric label="คำสั่งซื้อ 12 เดือน" value={n(st.orders)} hint={`อายุร้าน ${st.shopAge} เดือน`} />
    </div>
  );
}

export function AvailabilityList({ snap }: { snap: MarketplaceSnapshot }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line text-sm">
      {dataAvailability(snap).map((x) => (
        <li key={x.label} className="flex items-start gap-2 px-3 py-2">
          {x.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />}
          <span className="min-w-0 flex-1">
            <span className={cn('block', x.ok ? 'text-ink' : 'text-ink-soft')}>{x.label}</span>
            <span className="block text-xs text-ink-soft">{x.note}</span>
          </span>
          <Badge tone={x.ok ? 'success' : 'neutral'}>{x.ok ? 'มีข้อมูล' : 'ไม่มี'}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function ListingTable({ snap }: { snap: MarketplaceSnapshot }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="bg-bg text-left text-xs text-ink-soft">
          <tr>
            <th className="px-3 py-2 font-medium">สินค้า</th>
            <th className="px-3 py-2 text-right font-medium">ราคา</th>
            <th className="px-3 py-2 text-right font-medium">ขาย 12 เดือน</th>
            <th className="px-3 py-2 text-right font-medium">รีวิว</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {snap.listings.map((l) => (
            <tr key={l.id}>
              <td className="px-3 py-2">
                <span className="block text-ink">{l.name}</span>
                <span className="text-xs text-ink-soft">{PRODUCT_RISK_LABEL[l.productRisk]}</span>
              </td>
              <td className="px-3 py-2 text-right text-ink">{baht(l.price)}</td>
              <td className="px-3 py-2 text-right text-ink">{n(l.unitsSold12m)}</td>
              <td className="px-3 py-2 text-right text-ink">
                {n(l.reviewCount)} · {l.avgRating.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** ที่มาของข้อมูล (Data Source) */
export function SourceLine({ connection }: { connection: MarketplaceConnection }) {
  return (
    <p className="text-xs text-ink-soft">
      แหล่งข้อมูล: {PLATFORMS[connection.platform].label} · การเชื่อมต่อ {connection.id} · Shop ID จำลอง {connection.mockShopId}
      {connection.lastSyncAt && ` · อัปเดตข้อมูล ${fmtDate(connection.lastSyncAt, true)}`}
    </p>
  );
}

/** ตัวอย่างหน้าร้านบน Marketplace สำหรับผู้บริโภค — Mockup ภายในแอป ไม่ใช่หน้าจริง และไม่เปิดเว็บไซต์ภายนอก */
export function StorePreview({ connection, snap, shopName }: { connection: MarketplaceConnection; snap: MarketplaceSnapshot; shopName: string }) {
  const st = snapshotStats(snap);
  return (
    <div className="overflow-hidden rounded-xl border border-line" aria-label="ตัวอย่างหน้าร้านบน Marketplace (Mockup)">
      <p className="bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-ink-soft">ตัวอย่างหน้าร้านบน {PLATFORMS[connection.platform].label} — Mockup ภายในแอป (ไม่ใช่หน้าจริง)</p>
      <div className="flex items-center gap-3 p-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-50 text-lg font-bold text-primary">{shopName.charAt(0)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{shopName}</p>
          <p className="flex items-center gap-1 text-xs text-ink-soft">
            <Star className="h-3.5 w-3.5 text-warning" />
            {st.reviews ? `${st.rating.toFixed(1)} (${n(st.reviews)} รีวิว)` : 'ยังไม่มีรีวิว'} · Shop ID {connection.mockShopId}
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-3">
        {snap.listings.slice(0, 6).map((l) => (
          <li key={l.id} className="rounded-lg border border-line p-2 text-xs">
            <Package className="mb-1 h-6 w-6 text-ink-soft" />
            <p className="line-clamp-2 text-ink">{l.name}</p>
            <p className="mt-1 font-semibold text-primary">{baht(l.price)}</p>
            <p className="text-ink-soft">ขายแล้ว {n(l.unitsSold12m)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
