import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, HelpCircle, Info, Scale, Star } from 'lucide-react';
import { useMarketplaceStore } from '@/stores';
import { reportDemo } from '@/stores/demo';
import { useMyMerchants } from '@/hooks/useCurrent';
import { currentModel } from '@/stores/assessmentConfig';
import { dataBundle } from '@/stores/workflowsV2';
import { Alert, Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Tabs } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { assessTrust } from '@/features/trust-assessment/engine';
import { buildAssessmentInput, usableConnections } from '@/features/trust-assessment/inputs';
import { MODEL_V2 } from '@/features/trust-assessment/model';
import { CONFIDENCE_LABEL } from '@/features/trust-assessment/labels';
import { BandBadge, PricePanel, ReviewPanel, SalesPanel } from '@/features/trust-assessment/components/AssessmentParts';
import type { MarketplaceConnection, MarketplaceSnapshot } from '../types';
import { PLATFORMS } from '../data/platforms';
import { productRef, PRODUCT_RISK_LABEL } from '../data/catalog';
import { snapshotOf } from '../services/generator';
import { analyzePrices } from '../analysis/price';
import { analyzeSales } from '../analysis/sales';
import { analyzeReviews } from '../analysis/reviews';
import { analyzeCase, COMPARISON_CASES, effectiveCategory, type ComparisonCaseId } from '../analysis/comparison';
import { productsOfCategory } from '../data/catalog';
import { BUSINESS_CATEGORIES } from '@/constants/labels';
import { MarketplaceDisclaimer } from '../components/MarketplaceParts';

type Tab = 'price' | 'sales' | 'reviews' | 'risk' | 'compare' | 'summary';
const TABS: { value: Tab; label: string }[] = [
  { value: 'price', label: 'ราคา' },
  { value: 'sales', label: 'ยอดขาย' },
  { value: 'reviews', label: 'รีวิว' },
  { value: 'risk', label: 'สัญญาณ' },
  { value: 'compare', label: 'เปรียบเทียบ' },
  { value: 'summary', label: 'สรุป' },
];
const n = (x: number) => x.toLocaleString('th-TH');
const pct = (r: number) => `${Math.round(r * 100)}%`;

/** ผลวิเคราะห์ด้วยฟังก์ชันชุดเดียวกับ Trust Assessment Engine (P3) */
function analyze(snaps: MarketplaceSnapshot[]) {
  return { price: analyzePrices(snaps), sales: analyzeSales(snaps), reviews: analyzeReviews(snaps) };
}

export default function MarketplaceAnalysisPage() {
  const { active: m } = useMyMerchants();
  const all = useMarketplaceStore((s) => s.items);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'price') as Tab;

  const conns = useMemo(() => (m ? usableConnections(all, m.id) : []), [all, m]);
  const snaps = useMemo(() => (m ? conns.map((c) => snapshotOf(c, m.category)) : []), [conns, m]);
  const a = useMemo(() => analyze(snaps), [snaps]);

  if (!m)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="วิเคราะห์พฤติกรรมการขาย" back={{ to: '/m', label: 'หน้าหลัก' }} />
        <EmptyState title="ยังไม่มีร้านค้า" action={<LinkButton to="/m/register-shop">ลงทะเบียนร้านค้า</LinkButton>} />
      </div>
    );

  const sources = conns.map((c) => c.platform);
  const has = snaps.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title="วิเคราะห์พฤติกรรมการขาย"
        subtitle={`${m.shopName} — ${has ? sources.map((p) => PLATFORMS[p].label).join(' + ') : 'ยังไม่มีข้อมูล Marketplace'}`}
        icon={BarChart3}
        back={{ to: '/m/marketplace', label: 'Marketplace Connection' }}
        action={
          <LinkButton to="/m/trust" icon={ArrowRight}>
            ประเมินความน่าเชื่อถือ
          </LinkButton>
        }
      />
      <MarketplaceDisclaimer />
      <Tabs tabs={TABS} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />

      {!has && tab !== 'compare' ? (
        <Card>
          <EmptyState title="ยังไม่มีข้อมูล Marketplace ที่ซิงก์สำเร็จ" desc="เชื่อมต่อ Shopee หรือ Lazada (จำลอง) ก่อน — หรือดูแท็บ “เปรียบเทียบ” เพื่อเข้าใจวิธีวิเคราะห์จากกรณีตัวอย่าง" action={<LinkButton to="/m/marketplace">เชื่อมต่อ Marketplace</LinkButton>} />
        </Card>
      ) : tab === 'price' ? (
        <PriceSection snaps={snaps} price={a.price} />
      ) : tab === 'sales' ? (
        <SalesSection a={a} sources={sources} />
      ) : tab === 'reviews' ? (
        <ReviewSection a={a} />
      ) : tab === 'risk' ? (
        <RiskSection a={a} conns={conns} />
      ) : tab === 'compare' ? (
        <CompareSection key={m.id} merchantId={m.id} shopCategory={m.category} />
      ) : (
        <SummarySection a={a} sources={sources} />
      )}
    </div>
  );
}

type A = ReturnType<typeof analyze>;

function PriceSection({ snaps, price }: { snaps: MarketplaceSnapshot[]; price: A['price'] }) {
  const listings = snaps.flatMap((s) => s.listings.map((l) => ({ ...l, platform: s.platform })));
  const prices = listings.map((l) => l.price);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="ช่วงราคาสินค้าเทียบช่วงอ้างอิง" subtitle={`${listings.length} รายการ · ราคา ${n(Math.min(...prices))}–${n(Math.max(...prices))} บาท`} />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-ink-soft">
              <tr>
                <th className="py-1.5 font-medium">สินค้า / หมวด</th>
                <th className="py-1.5 text-right font-medium">ราคา</th>
                <th className="py-1.5 text-right font-medium">ราคากลางอ้างอิง</th>
                <th className="py-1.5 text-right font-medium">เทียบราคากลาง</th>
                <th className="py-1.5 font-medium">ความเสี่ยงสินค้า</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {listings.map((l) => {
                const median = productRef(l.productKey)?.median ?? l.price;
                return (
                  <tr key={l.id}>
                    <td className="py-2">
                      <span className="block text-ink">{l.name}</span>
                      <span className="text-xs text-ink-soft">
                        {l.category} · {PLATFORMS[l.platform].label}
                      </span>
                    </td>
                    <td className="py-2 text-right text-ink">{n(l.price)}</td>
                    <td className="py-2 text-right text-ink-soft">{n(median)}</td>
                    <td className="py-2 text-right text-ink">{pct(l.price / median)}</td>
                    <td className="py-2">
                      <Badge tone={l.productRisk === 'high' ? 'error' : l.productRisk === 'medium' ? 'warning' : 'neutral'}>{PRODUCT_RISK_LABEL[l.productRisk]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <PricePanel price={price} />
      <Alert tone="info" icon={Scale}>
        ราคาถูกหรือแพงไม่ใช่หลักฐานว่าร้านทุจริต — ราคาต่ำมากในสินค้าความเสี่ยงสูงเป็นเพียง "ควรตรวจสอบเพิ่มเติม" และลดเป็นข้อสังเกตเมื่อมีคำสั่งซื้อ มูลค่าธุรกรรม หรือรีวิวสนับสนุน ส่วนราคาสูงเป็นข้อสังเกตเท่านั้น
      </Alert>
    </div>
  );
}

function SalesSection({ a, sources }: { a: A; sources: MarketplaceConnection['platform'][] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="จำนวนคำสั่งซื้อ 12 เดือน" value={n(a.sales.totalOrders)} />
        <Fact label="เดือนที่มีข้อมูล" value={`${a.sales.monthsOfData}/12`} />
        <Fact label="อายุร้าน" value={`${a.sales.shopAgeMonths} เดือน`} />
        <Fact label="มูลค่าธุรกรรมโดยประมาณ" value={`${n(Math.round(a.sales.transactionValue))} บาท`} />
      </div>
      <SalesPanel sales={a.sales} sources={sources} asOf={new Date()} />
    </div>
  );
}

function ReviewSection({ a }: { a: A }) {
  const r = a.reviews;
  const coverage = a.sales.totalOrders ? r.totalReviews / a.sales.totalOrders : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="คะแนนดาวเฉลี่ย" value={r.totalReviews ? `${r.avgRating.toFixed(2)} ดาว` : '—'} />
        <Fact label="คะแนนถ่วงรีวิวใหม่" value={r.totalReviews ? `${r.recentRating.toFixed(2)} ดาว` : '—'} />
        <Fact label="จำนวนรีวิว" value={n(r.totalReviews)} />
        <Fact label="ความครอบคลุมของรีวิว" value={pct(coverage)} hint="รีวิวต่อคำสั่งซื้อ" />
      </div>
      <ReviewPanel reviews={r} />
      <p className="text-xs text-ink-soft">วิเคราะห์ข้อความจากรีวิวตัวอย่างไม่เกิน 30 รายการต่อแพลตฟอร์ม และใช้คำสำคัญชุดเดียวกับ AI-02 (Complaint Assistant) — ไม่มีชื่อผู้รีวิว</p>
    </div>
  );
}

function RiskSection({ a, conns }: { a: A; conns: MarketplaceConnection[] }) {
  const all = [...a.price.findings, ...a.sales.findings, ...a.reviews.findings];
  const watch = all.filter((f) => f.level === 'watch');
  const info = all.filter((f) => f.level === 'info');
  const M = MODEL_V2.minimums;
  const sampleRisks = [
    conns.length < 2 && `ข้อมูลจากแหล่งเดียว (${conns.map((c) => PLATFORMS[c.platform].label).join('')}) — ยังเทียบข้ามแพลตฟอร์มไม่ได้`,
    a.sales.monthsOfData < 12 && `ข้อมูลการขาย ${a.sales.monthsOfData} เดือน (ไม่ครบ 12 เดือน)`,
    a.reviews.totalReviews < 30 && `รีวิว ${a.reviews.totalReviews} รายการ — ตัวอย่างน้อย คะแนนเฉลี่ยอาจเปลี่ยนได้มาก`,
    'ข้อความรีวิวใช้เพียงตัวอย่างไม่เกิน 30 รายการต่อแพลตฟอร์ม',
  ].filter(Boolean) as string[];
  const notAssessable = [
    a.sales.totalOrders < M.orders && `คำสั่งซื้อต่ำกว่าขั้นต่ำ ${M.orders} รายการ`,
    a.reviews.totalReviews < M.reviews && `รีวิวต่ำกว่าขั้นต่ำ ${M.reviews} รายการ`,
    a.sales.monthsOfData < M.months && `ข้อมูลการขายต่ำกว่าขั้นต่ำ ${M.months} เดือน`,
    'ข้อมูลผู้ซื้อและการชำระเงิน (ไม่ขอเข้าถึง)',
    'ยอดขายนอกแพลตฟอร์มที่เชื่อมต่อ (เช่น Facebook, LINE, หน้าร้าน)',
    'คุณภาพสินค้าจริง — ต้องอาศัยข้อร้องเรียนและการตรวจสอบของเจ้าหน้าที่',
  ].filter(Boolean) as string[];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader title="สัญญาณที่ควรตรวจสอบเพิ่มเติม" subtitle="ข้อสังเกตจากกฎจำลอง ไม่ใช่ข้อสรุปว่าร้านกระทำผิด" icon={AlertTriangle} />
        <div className="space-y-2 p-4 text-sm">
          {watch.length ? (
            watch.map((f) => (
              <p key={f.id} className="rounded-xl border border-warning/40 bg-warning-50/50 p-3">
                <b className="text-ink">{f.title}</b>
                <span className="block text-ink-soft">{f.detail}</span>
              </p>
            ))
          ) : (
            <p className="text-ink-soft">ไม่พบสัญญาณที่ควรตรวจสอบเพิ่มเติม</p>
          )}
          {info.length > 0 && (
            <ul className="space-y-1 text-xs text-ink-soft">
              {info.map((f) => (
                <li key={f.id}>
                  • <b>{f.title}</b> — {f.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="ความเสี่ยงจากข้อมูลตัวอย่าง" icon={Info} />
        <ul className="space-y-1.5 p-4 text-sm text-ink">
          {sampleRisks.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="ข้อมูลที่ยังไม่สามารถประเมินได้" icon={HelpCircle} />
        <ul className="space-y-1.5 p-4 text-sm text-ink">
          {notAssessable.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** เปรียบเทียบ 4 กรณีตัวอย่าง — ข้อมูลด้านตัวตนและการปฏิบัติตามใช้ของร้านปัจจุบัน ต่างกันเฉพาะข้อมูล Marketplace */
function CompareSection({ merchantId, shopCategory }: { merchantId: string; shopCategory: string }) {
  const [sel, setSel] = useState<ComparisonCaseId>('cheap_popular');
  const [category, setCategory] = useState(shopCategory);
  const used = effectiveCategory(category);
  const crossCategory = used !== effectiveCategory(shopCategory);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) reportDemo('analysis.compare', true);
  }, [touched, sel]);

  const rows = useMemo(() => {
    const base = buildAssessmentInput(merchantId, dataBundle(), new Date());
    const now = new Date().toISOString();
    return COMPARISON_CASES.map((c) => {
      const r = analyzeCase(c.id, category);
      const connection: MarketplaceConnection = { id: r.snap.connectionId, merchantId, platform: 'shopee', mockShopId: 'ตัวอย่าง', mockShopName: c.title, status: 'connected', scopes: [], archetype: 'established_good', seed: 0, createdAt: now, lastSyncAt: now };
      const result = base ? assessTrust({ ...base, marketplace: [{ connection, snapshot: r.snap }] }, currentModel()) : undefined;
      return { ...c, ...r, result };
    });
  }, [merchantId, category]);
  const cur = rows.find((r) => r.id === sel)!;
  const priceText = (r: (typeof rows)[number]) => {
    const watch = r.price.findings.filter((f) => f.level === 'watch').length;
    const below = r.price.findings.filter((f) => f.kind === 'below_reference').length;
    const above = r.price.findings.filter((f) => f.kind === 'above_reference').length;
    return watch ? `ควรตรวจสอบ ${watch} รายการ` : below ? `ต่ำกว่าอ้างอิง ${below} รายการ (มีหลักฐานสนับสนุน)` : above ? `สูงกว่าอ้างอิง ${above} รายการ (ข้อสังเกต)` : 'อยู่ในช่วงอ้างอิง';
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-4 text-sm">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">หมวดสินค้าที่ใช้เปรียบเทียบ</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-line bg-white px-2" aria-label="หมวดสินค้าที่ใช้เปรียบเทียบ">
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
                {c === shopCategory ? ' (หมวดของร้านคุณ)' : ''}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-ink-soft" data-testid="compare-category">
          ทั้ง 4 กรณีใช้สินค้าหมวด <b>{used}</b>
          {used !== category ? ` (ไม่มีข้อมูลสินค้าตัวอย่างของหมวด "${category}" จึงใช้หมวดนี้แทน)` : ''} และช่วงราคาอ้างอิงชุดเดียวกัน:{' '}
          {productsOfCategory(category)
            .map((p) => `${p.name} (${PRODUCT_RISK_LABEL[p.risk]})`)
            .join(' · ')}
        </p>
        {crossCategory && (
          <Alert tone="warning" title="เปรียบเทียบต่างหมวดกับร้านของคุณ">
            หมวด "{used}" ใช้ช่วงราคาอ้างอิงและระดับความเสี่ยงของสินค้าคนละชุดกับหมวดของร้านคุณ ({effectiveCategory(shopCategory)}) — ใช้ดูหลักการเท่านั้น ไม่ควรนำ Band หรือผลวิเคราะห์ไปเทียบข้ามหมวดโดยตรง
          </Alert>
        )}
      </Card>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="กรณีตัวอย่าง">
        {rows.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={sel === r.id}
            onClick={() => {
              if (r.id !== sel) setTouched(true);
              setSel(r.id);
            }}
            className={cn('rounded-xl border p-3 text-left text-sm', sel === r.id ? 'border-primary bg-primary-50' : 'border-line bg-white hover:bg-bg')}
          >
            <span className="block text-xs text-ink-soft">กรณีที่ {i + 1}</span>
            <span className="block font-medium text-ink">{r.title}</span>
            <span className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
              <Star className="h-3.5 w-3.5 text-warning" />
              {r.reviews.totalReviews ? r.reviews.avgRating.toFixed(2) : '—'} · {n(r.reviews.totalReviews)} รีวิว
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title={cur.title} subtitle={cur.desc} />
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Fact label="คะแนนดาว" value={cur.reviews.totalReviews ? cur.reviews.avgRating.toFixed(2) : '—'} />
            <Fact label="คำสั่งซื้อ 12 เดือน" value={n(cur.sales.totalOrders)} />
            <Fact label="รีวิว" value={n(cur.reviews.totalReviews)} />
            <Fact label="ราคาเทียบอ้างอิง" value={priceText(cur)} />
            <Fact label="รีวิวผิดธรรมชาติ" value={cur.reviews.burst ? `พบ (${pct(cur.reviews.burst.share)} ใน 7 วัน)` : 'ไม่พบ'} />
            <Fact label="อายุร้าน" value={`${cur.sales.shopAgeMonths} เดือน`} />
          </dl>
          {cur.result && (
            <div className="space-y-2 rounded-xl bg-bg p-3 text-sm">
              <p className="text-xs text-ink-soft">ผลประเมินที่ได้ (มุมร้านค้า — ไม่แสดงคะแนน)</p>
              <BandBadge band={cur.result.band} />
              <p className="text-ink">Coverage {cur.result.coverage.percent}%</p>
              <p className="text-ink">{CONFIDENCE_LABEL[cur.result.confidence.level].label}</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="เทียบทั้ง 4 กรณี" subtitle="วิเคราะห์ด้วย Engine ชุดเดียวกับร้านจริง — ข้อมูลด้านตัวตนและการปฏิบัติตามเหมือนกันทุกกรณี" />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-ink-soft">
              <tr>
                <th className="py-1.5 font-medium">กรณี</th>
                <th className="py-1.5 text-right font-medium">ดาว</th>
                <th className="py-1.5 text-right font-medium">คำสั่งซื้อ</th>
                <th className="py-1.5 text-right font-medium">รีวิว</th>
                <th className="py-1.5 font-medium">ราคา</th>
                <th className="py-1.5 font-medium">ผล</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className={cn(r.id === sel && 'bg-primary-50/50')}>
                  <td className="py-2 text-ink">{r.title}</td>
                  <td className="py-2 text-right text-ink">{r.reviews.totalReviews ? r.reviews.avgRating.toFixed(2) : '—'}</td>
                  <td className="py-2 text-right text-ink">{n(r.sales.totalOrders)}</td>
                  <td className="py-2 text-right text-ink">{n(r.reviews.totalReviews)}</td>
                  <td className="py-2 text-xs text-ink-soft">{priceText(r)}</td>
                  <td className="py-2">{r.result && <BandBadge band={r.result.band} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Alert tone="info" icon={HelpCircle} title="ทำไมคะแนนดาวใกล้เคียงกันจึงให้ผลต่างกัน">
        <ul className="mt-1 space-y-1">
          <li>• <b>จำนวนรีวิวและคำสั่งซื้อ</b> — 4.8 ดาวจาก 600 รีวิวน่าเชื่อถือกว่า 4.8 ดาวจาก 20 รีวิว และร้านที่ข้อมูลน้อยกว่าขั้นต่ำจะได้ Insufficient Data แทน Band</li>
          <li>• <b>ช่วงเวลาของรีวิว</b> — รีวิว 5 ดาวจำนวนมากใน 7 วัน ข้อความสั้นและซ้ำกัน ทำให้ความเชื่อมั่นของข้อมูลลดลงและไม่ได้ Band A</li>
          <li>• <b>บริบทของราคา</b> — ราคาต่ำที่มีคำสั่งซื้อและรีวิวสนับสนุนเป็นเพียงข้อสังเกต ราคาสูงไม่ถูกหักคะแนน</li>
          <li>• <b>ความครอบคลุมของข้อมูล</b> — ข้อมูลน้อยเดือนหรือแหล่งเดียวทำให้ Coverage ต่ำลง แม้คะแนนดาวจะดี</li>
        </ul>
      </Alert>
    </div>
  );
}

function SummarySection({ a, sources }: { a: A; sources: MarketplaceConnection['platform'][] }) {
  const watch = [...a.price.findings, ...a.sales.findings, ...a.reviews.findings].filter((f) => f.level === 'watch');
  const M = MODEL_V2.minimums;
  const enough = a.sales.totalOrders >= M.orders && a.reviews.totalReviews >= M.reviews && a.sales.monthsOfData >= M.months;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Analysis Summary" subtitle={`จาก ${sources.map((p) => PLATFORMS[p].label).join(' + ')}`} />
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Fact label="คำสั่งซื้อ 12 เดือน" value={n(a.sales.totalOrders)} />
            <Fact label="รีวิว / คะแนน" value={a.reviews.totalReviews ? `${n(a.reviews.totalReviews)} · ${a.reviews.avgRating.toFixed(2)} ดาว` : '—'} />
            <Fact label="รายการสินค้าที่วิเคราะห์" value={`${a.price.listingsAnalyzed} รายการ`} />
            <Fact label="สัญญาณที่ควรตรวจสอบ" value={watch.length ? `${watch.length} รายการ` : 'ไม่พบ'} />
          </div>
          <ul className="space-y-1.5 text-sm text-ink">
            <li>• ราคา: {a.price.findings.length ? `${a.price.findings.length} ข้อสังเกต (ควรตรวจสอบ ${a.price.watchCount})` : 'อยู่ในช่วงอ้างอิงทุกรายการ'}</li>
            <li>
              • ยอดขาย: จัดส่งตรงเวลา {pct(a.sales.onTimeShipRate)} · ยกเลิก {pct(a.sales.cancelRate)} · คืนสินค้า {pct(a.sales.returnRate)}
              {a.sales.spike && ` · ยอดเดือนล่าสุดสูงกว่าปกติ ${a.sales.spike.factor.toFixed(1)} เท่า`}
            </li>
            <li>• รีวิว: {a.reviews.burst ? 'พบรีวิวกระจุกตัวผิดธรรมชาติ' : 'ไม่พบรีวิวกระจุกตัว'}{a.reviews.negativeThemes.length ? ` · ประเด็นเชิงลบ: ${a.reviews.negativeThemes.map((t) => t.label).join(', ')}` : ''}</li>
            <li>• ความพอเพียงของข้อมูล: {enough ? 'เพียงพอสำหรับการให้ Band' : 'ยังไม่ถึงขั้นต่ำ — ผลประเมินจะเป็น Insufficient Data (ไม่ใช่ผลลบ)'}</li>
          </ul>
        </div>
      </Card>
      <Alert tone="success" title="ขั้นต่อไป: ประเมินความน่าเชื่อถือ" action={<LinkButton to="/m/trust" size="sm" icon={ArrowRight}>ประเมิน</LinkButton>}>
        ผลวิเคราะห์ชุดนี้คือข้อมูลของมิติ Sales Performance, Customer Experience และ Price Transparency ในการประเมิน 5 มิติ
      </Alert>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-bg p-2.5">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-semibold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}
