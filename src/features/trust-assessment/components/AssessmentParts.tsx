import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, Database, Gauge, Info, Lightbulb, Minus, ShieldCheck, Store } from 'lucide-react';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { PRODUCT_RISK_LABEL } from '@/features/marketplace/data/catalog';
import { Badge, Card, CardHeader, StatusBadge } from '@/components/common/ui';
import { TimeBarChart } from '@/components/common/Charts';
import { useAssessmentBadgeStore, useAssessmentStore } from '@/stores';
import { PublicBadgeBlock } from '@/features/automation/components/AutomationParts';
import { publicBadgeView } from '@/features/automation/router';
import { weightSetLabel } from '@/stores/assessmentConfig';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { latestAssessment } from '@/stores/workflowsV2';
import { COMPONENTS } from '../model';
import { ASSESSMENT_DISCLAIMER, BAND_LABEL, CONFIDENCE_LABEL, STANDING_LABEL } from '../labels';
import type { AssessmentResult, BandOrInsufficient, ConfidenceLevel, CoverageItem, Standing, TrustFactor } from '../types';
import type { Platform } from '@/features/marketplace/types';
import { publicAssessmentView, withoutInternalPoints } from '../publicView';

/** ข้อมูลขั้นต่ำที่ DataQuality ใช้ — ผลประเมินเต็ม (ร้านค้า/เจ้าหน้าที่) หรือ Public projection (ผู้บริโภค ไม่มีเหตุผลของ Confidence) */
type QualityInput = { coverage: { percent: number; items?: CoverageItem[] }; confidence: { level: ConfidenceLevel; reasons?: string[] } };

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

export function BandBadge({ band, large }: { band: BandOrInsufficient; large?: boolean }) {
  const b = BAND_LABEL[band];
  const color = { success: 'bg-success text-white', warning: 'bg-warning text-white', error: 'bg-error text-white', neutral: 'bg-ink-soft text-white' }[b.tone as 'success'];
  return (
    <span className={cn('inline-flex items-center gap-2', large && 'text-base')}>
      <span className={cn('grid shrink-0 place-items-center rounded-xl font-bold', large ? 'h-12 w-12 text-2xl' : 'h-7 w-7 text-sm', color)} aria-hidden>
        {band === 'insufficient' ? '–' : band}
      </span>
      <span className="font-semibold text-ink">{b.label}</span>
    </span>
  );
}

export function StandingBanner({ standing, reason }: { standing: Standing; reason?: string }) {
  if (standing === 'normal') return null;
  const s = STANDING_LABEL[standing];
  return (
    <div className={cn('flex gap-3 rounded-xl border p-3', standing === 'under_review' ? 'border-warning/40 bg-warning-50' : 'border-error/40 bg-error-50')} role="status">
      <Ban className={cn('mt-0.5 h-5 w-5 shrink-0', standing === 'under_review' ? 'text-warning' : 'text-error')} />
      <div className="text-sm">
        <p className="font-bold text-ink">{s.label}</p>
        <p className="text-ink">
          {reason} — {standing === 'under_review' ? 'ยังไม่สามารถขอ Badge เพิ่มได้ระหว่างการพิจารณา' : 'ไม่สามารถใช้ Badge ที่มีผลได้ แม้ผลประเมินข้อมูลการขายจะสูง'}
        </p>
      </div>
    </div>
  );
}

export function CoverageBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Data Coverage">
      <div className={cn('h-full rounded-full', percent >= 70 ? 'bg-success' : percent >= 40 ? 'bg-warning' : 'bg-ink-soft')} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Data Coverage และ Data Confidence — แสดงแยกกัน (D7) */
/** internal=true เฉพาะหน้าของเจ้าหน้าที่ — แสดงคะแนนที่หักในเหตุผลของ Confidence · บทบาทอื่นเห็นเหตุผลโดยไม่มีตัวเลขภายใน */
export function DataQuality({ result, detail, internal }: { result: QualityInput; detail?: boolean; internal?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-line p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <Database className="h-3.5 w-3.5" />
          Data Coverage — ความครบถ้วนของข้อมูล
        </p>
        <p className="mt-1 text-xl font-bold text-ink">{result.coverage.percent}%</p>
        <CoverageBar percent={result.coverage.percent} />
        {detail && result.coverage.items && (
          <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
            {result.coverage.items.map((c) => (
              <li key={c.key} className="flex justify-between gap-2">
                <span>{c.label}</span>
                <span className="text-ink">
                  {c.have.toLocaleString('th-TH')}/{c.target.toLocaleString('th-TH')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-line p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <Gauge className="h-3.5 w-3.5" />
          Data Confidence — ความน่าเชื่อถือของข้อมูล
        </p>
        <div className="mt-1">
          <StatusBadge map={CONFIDENCE_LABEL} value={result.confidence.level} />
        </div>
        {result.confidence.reasons && (
          <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
            {result.confidence.reasons.map((r) => (
              <li key={r}>• {internal ? r : withoutInternalPoints(r)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SourcesLine({ result }: { result: Pick<AssessmentResult, 'dataSources' | 'computedAt' | 'modelVersion' | 'weightSet'> }) {
  return (
    <p className="text-xs text-ink-soft">
      แหล่งข้อมูล: ข้อมูลในระบบ{result.dataSources.map((p) => ` · ${PLATFORMS[p].label}`).join('')} · ประเมินเมื่อ {fmtDate(result.computedAt, true)} · โมเดล {result.modelVersion} · {weightSetLabel(result.weightSet)}
    </p>
  );
}

/**
 * มุมผู้บริโภค (D2): Band, Coverage, Confidence และคำอธิบาย — ไม่แสดงคะแนนตัวเลข ยอดขาย หรือสัญญาณที่ยังไม่มีข้อสรุป
 */
export function PublicAssessmentCard({ merchantId }: { merchantId: string }) {
  const items = useAssessmentStore((s) => s.items);
  const latest = latestAssessment(merchantId, items);
  // หน้าสาธารณะใช้เฉพาะ Public projection — ไม่มีคะแนนตัวเลข รายละเอียด Risk Signal หรือเหตุผลของ Confidence
  const a = latest && { result: publicAssessmentView(latest.result) };
  const badge = useAssessmentBadgeStore((s) => s.items.find((b) => b.merchantId === merchantId));
  // ระหว่างเจ้าหน้าที่ตรวจข้อมูลตัวตน/หลักฐานที่ขัดแย้ง ข้อมูลอาจไม่ใช่ของร้านนี้ — ไม่แสดง Band
  const showBand = !badge || publicBadgeView(badge.status).showBand;
  return (
    <Card>
      <CardHeader title="ผลประเมินจากข้อมูลการขาย (Trust Assessment)" subtitle="ข้อมูลประกอบ — ไม่ใช่การรับรอง" icon={ShieldCheck} />
      <div className="space-y-3 p-4 sm:p-5">
        {!a ? (
          <p className="text-sm text-ink-soft">ร้านยังไม่ได้เชื่อมต่อข้อมูล Marketplace (จำลอง) จึงยังไม่มีผลประเมิน — ไม่ได้หมายความว่าร้านมีปัญหา</p>
        ) : (
          <>
            <PublicBadgeBlock merchantId={merchantId} />
            <StandingBanner standing={a.result.standing} reason={a.result.standingReason} />
            {showBand && (
              <>
                <div>
                  <BandBadge band={a.result.band} large />
                  <p className="mt-1 text-sm text-ink-soft">{BAND_LABEL[a.result.band].desc}</p>
                </div>
                <DataQuality result={a.result} />
              </>
            )}
            <ul className="space-y-1 text-sm text-ink">
              {a.result.publicSummary.map((s) => (
                <li key={s} className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {s}
                </li>
              ))}
            </ul>
            <SourcesLine result={a.result} />
          </>
        )}
        <p className="rounded-lg border border-warning/30 bg-warning-50 p-2.5 text-xs text-[#7a4705]">Trust Badge และผลประเมินไม่ใช่การรับประกันว่าจะไม่มีปัญหาการซื้อขาย — ควรตรวจสอบรายละเอียดสินค้า เงื่อนไขการขาย และช่องทางชำระเงินทุกครั้ง</p>
        <p className="rounded-lg bg-bg p-2.5 text-xs text-ink-soft">{ASSESSMENT_DISCLAIMER}</p>
      </div>
    </Card>
  );
}

function Direction({ f }: { f: TrustFactor }) {
  if (f.direction === 'positive') return <ArrowUpRight className="h-4 w-4 shrink-0 text-success" aria-label="ส่งผลบวก" />;
  if (f.direction === 'negative') return <ArrowDownRight className="h-4 w-4 shrink-0 text-error" aria-label="ส่งผลลบ" />;
  return <Minus className="h-4 w-4 shrink-0 text-ink-soft" aria-label="ไม่มีผล" />;
}

/** รายการปัจจัย — showNumbers=false สำหรับร้านค้า (เห็นทิศทาง ไม่เห็นคะแนน) / true สำหรับเจ้าหน้าที่ */
export function FactorList({ result, showNumbers }: { result: AssessmentResult; showNumbers?: boolean }) {
  return (
    <div className="space-y-4">
      {result.components.map((c) => (
        <section key={c.id}>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            {c.id} {c.label}
            <span className="text-xs font-normal text-ink-soft">({COMPONENTS[c.id].source})</span>
            {!c.available && <Badge tone="neutral">ไม่มีข้อมูล — ไม่นับในการประเมิน</Badge>}
            {showNumbers && c.available && <Badge tone="info">คะแนน {c.score}/100</Badge>}
          </p>
          {c.available && (
            <ul className="mt-1 divide-y divide-line rounded-xl border border-line">
              {c.factors.map((f) => (
                <FactorRow key={f.id} f={f} showNumbers={showNumbers} />
              ))}
            </ul>
          )}
        </section>
      ))}
      <section>
        <p className="text-sm font-semibold text-ink">สัญญาณที่ควรตรวจสอบเพิ่มเติม</p>
        {result.riskFactors.length ? (
          <ul className="mt-1 divide-y divide-line rounded-xl border border-warning/40 bg-warning-50/40">
            {result.riskFactors.map((f) => (
              <FactorRow key={f.id} f={f} showNumbers={showNumbers} />
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">ไม่พบ</p>
        )}
        <p className="mt-1 text-xs text-ink-soft">สัญญาณเหล่านี้เป็นข้อสังเกตจากกฎจำลองให้ตรวจสอบเพิ่มเติม ไม่ใช่ข้อสรุปว่าร้านกระทำผิด</p>
      </section>
    </div>
  );
}

function FactorRow({ f, showNumbers }: { f: TrustFactor; showNumbers?: boolean }) {
  return (
    <li className="flex gap-2 p-2.5 text-sm">
      <Direction f={f} />
      <div className="min-w-0 flex-1">
        <p className="text-ink">
          {f.label}: <span className="font-medium">{f.value}</span>
          {showNumbers && <span className="ml-1 text-xs text-ink-soft">({f.impact > 0 ? '+' : ''}{f.impact})</span>}
        </p>
        {showNumbers && f.evidence.length > 0 && (
          <ul className="mt-0.5 text-xs text-ink-soft">
            {f.evidence.slice(0, 4).map((e) => (
              <li key={e}>– {e}</li>
            ))}
          </ul>
        )}
        {f.improve && (
          <p className="mt-0.5 flex gap-1 text-xs text-primary">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
            {f.improve}
          </p>
        )}
      </div>
    </li>
  );
}

/** ตารางคำนวณทีละขั้น (เจ้าหน้าที่/ผู้ดูแลระบบ — D2, D5) */
export function CalculationTable({ result }: { result: AssessmentResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="py-2 pr-2">องค์ประกอบ</th>
            <th className="px-2 text-right">น้ำหนักที่ตั้ง</th>
            <th className="px-2 text-right">น้ำหนักที่ใช้</th>
            <th className="px-2 text-right">คะแนน</th>
            <th className="pl-2 text-right">ผลต่อคะแนนรวม</th>
          </tr>
        </thead>
        <tbody>
          {result.components.map((c) => (
            <tr key={c.id} className="border-b border-line">
              <td className="py-2 pr-2">
                {c.id} {c.label}
              </td>
              <td className="px-2 text-right">{c.weight}%</td>
              <td className="px-2 text-right">{c.available ? `${c.effectiveWeight}%` : '—'}</td>
              <td className="px-2 text-right">{c.available ? c.score : 'ไม่มีข้อมูล'}</td>
              <td className="pl-2 text-right">{c.available ? c.contribution.toFixed(1) : '—'}</td>
            </tr>
          ))}
          <tr className="border-b border-line font-medium">
            <td className="py-2" colSpan={4}>
              คะแนนตั้งต้น (ผลรวม)
            </td>
            <td className="text-right">{result.baseScore.toFixed(1)}</td>
          </tr>
          {result.riskFactors.map((f) => (
            <tr key={f.id} className="border-b border-line text-warning">
              <td className="py-2" colSpan={4}>
                หัก: {f.label}
              </td>
              <td className="text-right">{f.impact}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="py-2" colSpan={4}>
              คะแนนสุดท้าย → Band ตามคะแนน {result.scoreBand}
            </td>
            <td className="text-right">{result.score.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>
      <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
        <li>• น้ำหนักที่ใช้ = น้ำหนักที่ตั้ง ÷ ผลรวมน้ำหนักขององค์ประกอบที่มีข้อมูล × 100 (องค์ประกอบที่ไม่มีข้อมูลไม่ถูกนับเป็น 0)</li>
        <li>• Band A ต้องมีความเชื่อมั่นของข้อมูลสูง ไม่มีสัญญาณที่ควรตรวจสอบ ความครอบคลุมของข้อมูลเพียงพอ และข้อมูลแต่ละแพลตฟอร์มไม่ขัดแย้งกัน มิฉะนั้นสูงสุด B · Band ที่แสดง: {BAND_LABEL[result.band].label}</li>
        {!!result.bandCapReasons?.length && <li>• จำกัดไว้ที่ Band B เพราะ: {result.bandCapReasons.join(' · ')}</li>}
        {result.insufficientReasons.length > 0 && <li>• Insufficient Data: {result.insufficientReasons.join(' · ')}</li>}
        <li>• Standing ({STANDING_LABEL[result.standing].label}) แยกจาก Band และไม่ถูกนำมาคิดเป็นคะแนน</li>
      </ul>
    </div>
  );
}

const Stat2 = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg bg-bg p-2.5">
    <p className="text-xs text-ink-soft">{label}</p>
    <p className="font-semibold text-ink">{value}</p>
  </div>
);

/**
 * 5 Assessment Dimensions (มุมร้านค้า/ผู้บริหาร) — น้ำหนักที่ใช้ ความพร้อมของข้อมูล และทิศทางของปัจจัย
 * ไม่แสดงคะแนนภายใน (D2) — เจ้าหน้าที่ดูคะแนนได้ที่ตารางวิธีคำนวณ
 */
export function DimensionGrid({ result }: { result: AssessmentResult }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {result.components.map((c) => {
        const pos = c.factors.filter((f) => f.direction === 'positive' && f.id !== 'c2.base').length;
        const neg = c.factors.filter((f) => f.direction === 'negative').length;
        return (
          <li key={c.id} className={cn('rounded-xl border p-3 text-sm', c.available ? 'border-line' : 'border-dashed border-line bg-bg')}>
            <p className="text-xs text-ink-soft">
              {c.id} · น้ำหนัก {c.weight}%{c.available && c.effectiveWeight !== c.weight && ` → ${Math.round(c.effectiveWeight)}%`}
            </p>
            <p className="font-semibold text-ink">{COMPONENTS[c.id].en}</p>
            <p className="text-xs text-ink-soft">{c.label}</p>
            {c.available ? (
              <p className="mt-1.5 flex flex-wrap gap-1">
                {pos > 0 && <Badge tone="success">↑ {pos} ปัจจัย</Badge>}
                {neg > 0 && <Badge tone="warning">↓ {neg} ปัจจัย</Badge>}
                {!pos && !neg && <Badge tone="neutral">ไม่มีปัจจัยลบ</Badge>}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-soft">ไม่มีข้อมูล — ไม่นับเป็นศูนย์ (กระจายน้ำหนักให้มิติอื่น)</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** ข้อมูลที่ควรเพิ่มเติม — จากข้อมูลที่ยังขาด ความครอบคลุม และคำแนะนำของแต่ละปัจจัย */
export function ImproveList({ result }: { result: AssessmentResult }) {
  const items = [
    ...result.insufficientReasons.map((r) => `เพิ่มข้อมูลให้ถึงขั้นต่ำ: ${r}`),
    ...result.coverage.items.filter((c) => c.ratio < 1 && c.key === 'platforms').map(() => 'เชื่อมต่อแพลตฟอร์มที่ขายอยู่เพิ่ม (หรือส่งหลักฐานการขายจากช่องทางอื่นให้เจ้าหน้าที่)'),
    ...[...result.components.flatMap((c) => c.factors), ...result.riskFactors].map((f) => f.improve).filter((x): x is string => !!x),
  ];
  const unique = [...new Set(items)];
  if (!unique.length) return <p className="text-sm text-ink-soft">ข้อมูลครบถ้วนในเกณฑ์ดี — รักษามาตรฐานและซิงก์ข้อมูลให้เป็นปัจจุบัน</p>;
  return (
    <ul className="space-y-1.5 text-sm text-ink">
      {unique.map((t) => (
        <li key={t} className="flex gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** เดือนย้อนหลัง 12 เดือนสำหรับกราฟ (เก่า → ใหม่) */
const monthSeries = (monthlyOrders: number[], asOf: Date) =>
  monthlyOrders.map((value, i) => {
    const dt = new Date(asOf.getFullYear(), asOf.getMonth() - (11 - i), 1);
    return { name: TH_MONTHS[dt.getMonth()], value };
  });

type Analysis = AssessmentResult['analysis'];

/** ยอดขายและการจัดส่ง — ใช้ผลจาก analyzeSales (P3) */
export function SalesPanel({ sales, sources, asOf, className }: { sales: Analysis['sales']; sources: Platform[]; asOf: Date; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="ยอดขายและการจัดส่ง" subtitle={`รวม ${sources.map((p) => PLATFORMS[p].label).join(' + ')}`} icon={Store} />
      <div className="space-y-3 p-4">
        <TimeBarChart data={monthSeries(sales.monthlyOrders, asOf)} label="คำสั่งซื้อ" height={180} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat2 label="อัตรายกเลิก" value={pct(sales.cancelRate)} />
          <Stat2 label="อัตราคืนสินค้า" value={pct(sales.returnRate)} />
          <Stat2 label="จัดส่งตรงเวลา" value={pct(sales.onTimeShipRate)} />
          <Stat2 label="ตอบแชต" value={pct(sales.chatResponseRate)} />
        </div>
        <Findings items={sales.findings} />
      </div>
    </Card>
  );
}

/** คะแนนและรีวิว — ใช้ผลจาก analyzeReviews (P3) */
export function ReviewPanel({ reviews, className }: { reviews: Analysis['reviews']; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="คะแนนและรีวิว" subtitle={`${reviews.totalReviews.toLocaleString('th-TH')} รีวิว · เฉลี่ย ${reviews.avgRating.toFixed(2)} ดาว`} />
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = reviews.histogram[star - 1];
            const w = reviews.totalReviews ? (n / reviews.totalReviews) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-10 text-ink-soft">{star} ดาว</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
                </div>
                <span className="w-10 text-right text-ink">{n}</span>
              </div>
            );
          })}
        </div>
        <Findings items={reviews.findings} />
      </div>
    </Card>
  );
}

/** ราคาเทียบช่วงอ้างอิง — ใช้ผลจาก analyzePrices (P3, D9) */
export function PricePanel({ price, className }: { price: Analysis['price']; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="ราคาเทียบช่วงอ้างอิงของประเภทสินค้า" subtitle={`วิเคราะห์ ${price.listingsAnalyzed} รายการ — ราคาถูกหรือแพงไม่ใช่หลักฐานว่าร้านทุจริต`} />
      <div className="p-4">
        {price.findings.length ? (
          <ul className="space-y-2">
            {price.findings.map((f) => (
              <li key={f.id} className={cn('rounded-xl border p-3 text-sm', f.level === 'watch' ? 'border-warning/40 bg-warning-50/50' : 'border-line')}>
                <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {f.level === 'watch' && <AlertTriangle className="h-4 w-4 text-warning" />}
                  {f.title}
                  <Badge tone={f.productRisk === 'high' ? 'error' : f.productRisk === 'medium' ? 'warning' : 'neutral'}>{PRODUCT_RISK_LABEL[f.productRisk]}</Badge>
                </p>
                <p className="text-ink-soft">{f.detail}</p>
                {f.mitigations.length > 0 && <p className="mt-1 text-xs text-success">หลักฐานสนับสนุน: {f.mitigations.join(' · ')}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">ราคาทุกรายการอยู่ในช่วงอ้างอิงของประเภทสินค้า</p>
        )}
      </div>
    </Card>
  );
}

/** ผลวิเคราะห์ราคา ยอดขาย และรีวิว (ร้านค้าและเจ้าหน้าที่) */
export function AnalysisPanels({ result }: { result: AssessmentResult }) {
  const { price, sales, reviews } = result.analysis;
  if (!result.dataSources.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SalesPanel sales={sales} sources={result.dataSources} asOf={new Date(result.computedAt)} />
      <ReviewPanel reviews={reviews} />
      <PricePanel price={price} className="lg:col-span-2" />
    </div>
  );
}

export function Findings({ items }: { items: { id: string; level: string; title: string; detail: string }[] }) {
  if (!items.length) return <p className="text-xs text-ink-soft">ไม่พบข้อสังเกต</p>;
  return (
    <ul className="space-y-1 text-xs">
      {items.map((f) => (
        <li key={f.id} className={f.level === 'watch' ? 'text-[#7a4705]' : 'text-ink-soft'}>
          {f.level === 'watch' ? '⚠ ' : '• '}
          <b>{f.title}</b> — {f.detail}
        </li>
      ))}
    </ul>
  );
}

export function AssessmentLink({ id }: { id: string }) {
  return (
    <Link to={`/o/assessments/${id}`} className="font-mono text-xs text-primary hover:underline">
      {id}
    </Link>
  );
}
