import { AlertTriangle, BadgeCheck, CalendarRange, Check, Info, MessageSquareWarning, ShoppingBag, Star, Tag, TrendingUp, UserCheck, type LucideIcon } from 'lucide-react';
import { COMPONENTS, MODEL_V2, type ComponentId } from '@/features/trust-assessment/model';
import { ROUTING_POLICY } from '@/features/automation/policy';
import { cn } from '@/utils/cn';

/**
 * Homepage — เกณฑ์การจัดระดับความน่าเชื่อถือ (Band A / B / C / D)
 * ทุกตัวเลขอ่านจาก MODEL_V2 (Engine v2.1-sim) — แสดงเป็น "กฎ" เท่านั้น ไม่มีคะแนนของร้านใด
 */

/** ชื่อปัจจัยสำหรับหน้าสาธารณะ เรียงตามน้ำหนัก */
const FACTOR_VIEW: { id: ComponentId; label: string; icon: LucideIcon }[] = [
  { id: 'C1', label: 'ตัวตนและธุรกิจ', icon: UserCheck },
  { id: 'C2', label: 'ผลการขายและการจัดส่ง', icon: TrendingUp },
  { id: 'C3', label: 'เสียงลูกค้า (รีวิว)', icon: Star },
  { id: 'C5', label: 'การแก้ไขปัญหาและข้อร้องเรียน', icon: MessageSquareWarning },
  { id: 'C4', label: 'ความสมเหตุสมผลของราคา', icon: Tag },
];

const P = MODEL_V2.penalties;
const RISK_EXAMPLES: { label: string; points: number }[] = [
  { label: 'ข้อร้องเรียนร้ายแรงที่ยังไม่ได้รับการแก้ไข', points: P.seriousOpenComplaint },
  { label: 'ราคาผิดปกติเมื่อเทียบสินค้าประเภทเดียวกัน', points: P.priceWatch },
  { label: 'รีวิวผิดปกติ เช่น กระจุกตัวในช่วงสั้น ๆ', points: P.reviewBurst },
];

const B = MODEL_V2.bands;
const MIN = MODEL_V2.minimums;
const MAX_WEIGHT = Math.max(...Object.values(MODEL_V2.weights));

function BandLetter({ band, className }: { band: string; className: string }) {
  return <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl font-bold', className)}>{band}</span>;
}

export function BandCriteriaSection() {
  return (
    <section aria-labelledby="home-band-criteria" className="mx-auto max-w-6xl px-4 py-12 sm:px-6" data-testid="home-band-criteria">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Band Criteria</p>
        <h2 id="home-band-criteria" className="mt-1 text-xl font-bold leading-snug text-ink sm:text-2xl">
          เกณฑ์การจัดระดับความน่าเชื่อถือ
        </h2>
        <p className="mt-1.5 text-sm text-ink-soft sm:text-base">ประเมินจากข้อมูลร้านค้าและพฤติกรรมการดำเนินงาน โดยใช้คะแนน 0–100</p>
        <p className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-soft" data-testid="band-prototype-tag">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          เกณฑ์เริ่มต้นจากระบบต้นแบบ ({MODEL_V2.version}) — ปรับร่วมกับหน่วยงานได้ ไม่ใช่ข้อกำหนดทางราชการ
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        {/* ---- คะแนนรวม 0–100 */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="rounded-card border border-line bg-white p-5" data-testid="home-weights">
            <p className="font-semibold text-ink">
              คะแนนรวม 0–100 <span className="font-normal text-ink-soft">จาก 5 ปัจจัย</span>
            </p>
            <ul className="mt-4 space-y-3">
              {FACTOR_VIEW.map((f) => {
                const w = MODEL_V2.weights[f.id];
                return (
                  <li key={f.id} data-weight-factor={COMPONENTS[f.id].en}>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
                        <f.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-ink">{f.label}</span>
                      <span className="text-sm font-bold text-ink">{w}%</span>
                    </div>
                    <div className="ml-[42px] mt-1.5 h-2 overflow-hidden rounded-full bg-bg" role="presentation">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(w / MAX_WEIGHT) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-card border border-line bg-white p-5" data-testid="home-risk-examples">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
              หักคะแนนเมื่อพบสัญญาณความเสี่ยง (ตัวอย่าง)
            </p>
            <ul className="mt-3 space-y-2">
              {RISK_EXAMPLES.map((r) => (
                <li key={r.label} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink">{r.label}</span>
                  <span className="shrink-0 rounded-full bg-error-50 px-2 py-0.5 text-xs font-bold text-error">−{r.points}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-soft">สัญญาณความเสี่ยงเป็นข้อสังเกตเพื่อให้ตรวจสอบเพิ่มเติม ไม่ใช่ข้อสรุปว่าร้านกระทำผิด</p>
          </div>
        </div>

        {/* ---- Band A / B / C / D */}
        <div className="grid min-w-0 content-start gap-3 sm:grid-cols-2" aria-label="เกณฑ์ของแต่ละ Band">
          <div className="rounded-card border-2 border-primary bg-white p-5 sm:col-span-2" data-testid="band-card-A">
            <div className="flex items-center gap-3">
              <BandLetter band="A" className="bg-primary text-white" />
              <div className="min-w-0">
                <p className="font-bold text-ink">Band A — น่าเชื่อถือสูง</p>
                <p className="text-xs font-semibold text-primary">ต้องผ่านครบทั้ง 4 ข้อ</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[`คะแนน ≥ ${B.A}`, `Data Coverage ≥ ${MODEL_V2.bandA.minCoverage}%`, 'Data Confidence สูง', 'ไม่มี Risk Signal'].map((c) => (
                <li key={c} className="flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm font-medium text-ink">
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl border border-warning/40 bg-warning-50 px-3 py-2 text-sm text-ink" data-testid="band-a-cap">
              <b>คะแนนถึง {B.A} อย่างเดียวยังไม่พอ</b> — หากเงื่อนไขด้านข้อมูลหรือ Risk Signal ไม่ผ่าน จะได้สูงสุด Band B
            </p>
          </div>

          <div className="rounded-card border border-line bg-white p-5" data-testid="band-card-B">
            <div className="flex items-center gap-3">
              <BandLetter band="B" className="bg-info text-white" />
              <p className="min-w-0 font-bold text-ink">Band B — น่าเชื่อถือ</p>
            </div>
            <p className="mt-3 text-sm text-ink">
              คะแนน <b>{B.B}–{B.A - 1}</b>
            </p>
          </div>

          <div className="rounded-card border border-line bg-white p-5" data-testid="band-card-C">
            <div className="flex items-center gap-3">
              <BandLetter band="C" className="bg-warning text-white" />
              <p className="min-w-0 font-bold text-ink">Band C — ควรติดตาม</p>
            </div>
            <p className="mt-3 text-sm text-ink">
              คะแนน <b>{B.C}–{B.B - 1}</b>
            </p>
          </div>

          <div className="rounded-card border-2 border-dashed border-line bg-bg p-5 sm:col-span-2" data-testid="band-card-D">
            <div className="flex items-center gap-3">
              <BandLetter band="D" className="border-2 border-ink-soft/50 bg-white text-ink-soft" />
              <div className="min-w-0">
                <p className="font-bold text-ink-soft">Band D — ยังไม่ถึงเกณฑ์แสดง Badge</p>
                <p className="text-sm text-ink">
                  คะแนน <b>&lt; {B.C}</b> · ไม่มี Badge แสดงต่อผู้บริโภค
                </p>
              </div>
            </div>
          </div>

          <p className="flex gap-2 rounded-xl bg-white px-3 py-2.5 text-xs text-ink-soft sm:col-span-2" data-testid="band-visibility-note">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            ผู้บริโภคเห็นเฉพาะ Band และ Assessment Badge · คะแนนตัวเลข 0–100 แสดงเฉพาะเจ้าหน้าที่ตามสิทธิ์ · Badge เป็นผลประเมินอัตโนมัติ ไม่ใช่การรับรอง
          </p>
        </div>
      </div>

      {/* ---- ข้อมูลขั้นต่ำ — แยกจากคะแนน */}
      <div className="mt-4 rounded-card border border-line bg-primary-50/60 p-5" data-testid="home-min-data">
        <p className="font-semibold text-ink">ข้อมูลขั้นต่ำก่อนจัดระดับ Band</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-center">
          <ul className="grid grid-cols-3 gap-2">
            {[
              { v: `${MIN.orders}`, label: 'คำสั่งซื้อ', icon: ShoppingBag },
              { v: `${MIN.reviews}`, label: 'รีวิว', icon: Star },
              { v: `${MIN.months} เดือน`, label: 'ข้อมูลการขาย', icon: CalendarRange },
            ].map((x) => (
              <li key={x.label} className="rounded-xl border border-line bg-white px-3 py-2.5">
                <x.icon className="h-4 w-4 text-primary" aria-hidden />
                <p className="mt-1 text-lg font-bold leading-tight text-ink">{x.v}</p>
                <p className="text-xs text-ink-soft">{x.label}</p>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border-2 border-dashed border-ink-soft/40 bg-white px-4 py-3" data-testid="home-insufficient">
            <p className="text-sm text-ink">
              ข้อมูลยังไม่ถึงขั้นต่ำ → แสดงสถานะ <b>“ข้อมูลยังไม่เพียงพอ”</b>
            </p>
            <p className="mt-1 text-xs text-ink-soft">ไม่ได้หมายความว่าร้านค้ามีปัญหา</p>
          </div>
        </div>
        {ROUTING_POLICY.requireIdentityVerified && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink" data-testid="home-identity-rule">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              <b>ยืนยันตัวตน (Verified Identity)</b> — เป็น<b>เงื่อนไขก่อนแสดง Badge</b> ต่อผู้บริโภค ไม่ใช่เงื่อนไขในการคำนวณ Band · ร้านที่ยังไม่ยืนยันตัวตนจะแสดงสถานะ “รอร้านค้าอัปเดตข้อมูล”
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
