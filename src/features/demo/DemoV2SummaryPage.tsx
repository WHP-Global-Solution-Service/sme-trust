import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, Circle, Database, Gauge, GitBranch, HelpCircle, LayoutGrid, Link2, RotateCcw, Scale, ShieldCheck, SlidersHorizontal, Store, Trophy, User, UserCheck } from 'lucide-react';
import { confirmDialog, useAssessmentStore, useCertificationStore, useMarketplaceStore, useMerchantStore, useSessionStore } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { latestAssessment } from '@/stores/workflowsV2';
import { scenarioCode, trackScenarios } from '@/mock/scenarios';
import { startJourney } from '@/demo/controller';
import { TRUST_LEVELS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { cn } from '@/utils/cn';
import { Button, Card, CardHeader, Stat, StatusBadge } from '@/components/common/ui';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { BAND_LABEL, CONFIDENCE_LABEL, DECISION_LABEL } from '@/features/trust-assessment/labels';
import type { BandOrInsufficient } from '@/features/trust-assessment/types';
import { DemoFrame, PrototypeDisclaimer } from './DemoFrame';

const BANDS: BandOrInsufficient[] = ['A', 'B', 'C', 'D', 'insufficient'];

/** Executive Impact Summary — สรุปผลหลังสาธิต SME Trust v2 (คำนวณจากข้อมูลจำลองในเบราว์เซอร์เท่านั้น) */
export default function DemoV2SummaryPage() {
  const nav = useNavigate();
  const d = useDemoStore();
  const merchants = useMerchantStore((s) => s.items);
  const connections = useMarketplaceStore((s) => s.items);
  const assessments = useAssessmentStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);

  const path = trackScenarios('v2');
  const main = path.filter((s) => !s.branch);
  const doneMain = main.filter((s) => d.completed.includes(s.id)).length;

  // ตัวชี้วัดจาก Mock State
  const connected = connections.filter((c) => c.status === 'connected');
  const shopsConnected = new Set(connected.map((c) => c.merchantId)).size;
  const latest = merchants.map((m) => latestAssessment(m.id, assessments)).filter((a): a is NonNullable<typeof a> => !!a);
  const byBand = Object.fromEntries(BANDS.map((b) => [b, latest.filter((a) => a.result.band === b).length])) as Record<BandOrInsufficient, number>;
  const pending = assessments.filter((a) => a.status === 'pending_review').length;
  const decided = assessments.filter((a) => a.status === 'decided');
  const overrides = decided.filter((a) => a.decision?.overridesRecommendation).length;
  const blocked = latest.filter((a) => a.result.standing !== 'normal').length;

  // ผลของร้านใน Journey v2
  const ctx = d.results.s13 ?? d.results.s12 ?? d.results.s11 ?? d.results.s10 ?? d.results.s9 ?? d.journey;
  const shop = merchants.find((m) => m.id === ctx.merchantId);
  const a = assessments.find((x) => x.id === ctx.assessmentId);
  const cert = shop ? currentCert(certs, shop.id) : undefined;
  const shopConns = connected.filter((c) => c.merchantId === shop?.id);

  return (
    <DemoFrame menu>
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Trophy className="h-9 w-9" />
          <p className="mt-2 text-sm text-white/80">SME Trust — Marketplace & Trust Assessment</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Executive Impact Summary</h1>
          <p className="mt-2 max-w-3xl text-white/85">ใช้ข้อมูลการขายจากแพลตฟอร์มที่ร้านค้าใช้อยู่แล้ว (จำลอง) ประเมินความน่าเชื่อถืออย่างอธิบายได้ โดยเจ้าหน้าที่ยังเป็นผู้ตัดสินการรับรอง และผู้บริโภคเห็นข้อมูลที่เข้าใจง่ายพร้อมข้อจำกัด</p>
          <p className="mt-3 text-sm text-white/80">
            สาธิตแล้ว {doneMain}/{main.length} Scenario{d.completed.includes('s9b') && ' + เส้นทางทางเลือก 9B'}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {shop && (
          <Card>
            <CardHeader title={`ผลของร้านใน Journey: ${shop.shopName}`} subtitle={`${shop.id} — Merchant, Connection, Assessment และ Application เดียวกันตลอด Scenario 9–13`} icon={Store} />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact icon={Link2} label="ข้อมูลที่เชื่อมต่อ" value={shopConns.length ? shopConns.map((c) => PLATFORMS[c.platform].label).join(' + ') : 'ไม่มี'} hint={ctx.connectionId} />
              <Fact icon={Gauge} label="ผลประเมิน" value={a ? BAND_LABEL[a.result.band].label.split(' — ')[0] : '—'} hint={a ? `Coverage ${a.result.coverage.percent}% · ${CONFIDENCE_LABEL[a.result.confidence.level].label}` : undefined} />
              <Fact icon={UserCheck} label="การพิจารณาของเจ้าหน้าที่" value={a?.decision ? `${DECISION_LABEL[a.decision.kind].label}${a.decision.level ? ` Level ${a.decision.level}` : ''}` : a?.status === 'pending_review' ? 'รอพิจารณา' : '—'} hint={a?.decision?.applicationId ?? ctx.applicationId} />
              <Fact icon={BadgeCheck} label="ใบรับรองปัจจุบัน" value={cert ? `Level ${cert.level} — ${TRUST_LEVELS[cert.level].name}` : 'ยังไม่มี'} hint={cert?.id} />
            </div>
          </Card>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">ผลลัพธ์จากข้อมูลจำลอง</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="ร้านที่เชื่อมต่อข้อมูล Marketplace" value={shopsConnected} icon={Link2} hint={`${connected.length} การเชื่อมต่อที่ใช้งาน`} />
            <Stat label="ร้านที่มีผลประเมิน" value={latest.length} icon={Gauge} tone="info" hint={`จากร้านทั้งหมด ${merchants.length} ร้าน`} />
            <Stat label="รอเจ้าหน้าที่พิจารณา" value={pending} icon={Scale} tone="warning" />
            <Stat label="เจ้าหน้าที่พิจารณาแล้ว" value={decided.length} icon={UserCheck} tone="success" hint={`ตัดสินต่างจากข้อเสนอของระบบ ${overrides} เรื่อง`} />
          </div>
          <Card className="mt-3">
            <CardHeader title="ผลประเมินล่าสุดของแต่ละร้าน" subtitle="Insufficient Data ไม่ใช่ผลลบ · สถานะการรับรอง (ระงับ/เพิกถอน) แยกจาก Band" />
            <ul className="grid gap-2 p-4 md:grid-cols-3 lg:grid-cols-5">
              {BANDS.map((b) => (
                <li key={b} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2 md:flex-col md:items-start">
                  <StatusBadge map={BAND_LABEL} value={b} />
                  <span className="text-lg font-bold text-ink">{byBand[b]} ร้าน</span>
                </li>
              ))}
            </ul>
            <p className="px-4 pb-4 text-xs text-ink-soft">ร้านที่สถานะการรับรองไม่ปกติ {blocked} ร้าน — ใช้หรือขอ Badge ไม่ได้ แม้ Band สูง</p>
          </Card>
          <p className="mt-2 text-xs text-ink-soft">ตัวเลขทั้งหมดเป็นข้อมูลสาธิต ไม่ใช่สถิติจริงของหน่วยงานหรือแพลตฟอร์มใด</p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Impact icon={Store} cls="text-primary" title="ผู้ประกอบการ SME">
            <li>ใช้ประวัติการขายที่มีอยู่แล้วแทนการกรอกหรือส่งเอกสารเพิ่ม</li>
            <li>รู้ว่าปัจจัยใดส่งผลและปรับปรุงได้ตรงจุด โดยไม่เปิดเผยคะแนนภายใน</li>
            <li>ร้านที่ไม่มีบัญชี Marketplace เข้าร่วมได้ ไม่ถูกหักคะแนน</li>
          </Impact>
          <Impact icon={User} cls="text-info" title="ผู้บริโภค">
            <li>เห็น Band, Coverage และ Confidence ที่เข้าใจง่ายก่อนตัดสินใจซื้อ</li>
            <li>ตรวจสอบช่องทางขายและใบรับรองของร้านเดียวกันได้ในที่เดียว</li>
            <li>รู้ข้อจำกัดชัดเจน — Badge ไม่ใช่การรับประกัน</li>
          </Impact>
          <Impact icon={ShieldCheck} cls="text-secondary" title="สคบ. / เจ้าหน้าที่">
            <li>ข้อมูลประกอบครบ คัดกรองร้านที่ควรตรวจสอบได้เร็วขึ้น</li>
            <li>เห็นวิธีคำนวณทุกขั้น ตัดสินต่างจากระบบได้พร้อมบันทึกเหตุผล</li>
            <li>อนุมัติผ่านกระบวนการรับรองเดิม มี Audit Log ทุกการตัดสิน</li>
          </Impact>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="หลักการที่ระบบยึดถือ" icon={Scale} />
            <ul className="space-y-1.5 p-4 text-sm text-ink">
              <li>• ไม่ออกใบรับรองอัตโนมัติ — ต้องผ่านเจ้าหน้าที่และเกณฑ์การรับรอง (Level 1–4 ความหมายเดิม)</li>
              <li>• ผู้บริโภคไม่เห็นคะแนน 0–100 — เจ้าหน้าที่เห็นคะแนนและวิธีคำนวณ</li>
              <li>• ข้อมูลที่ขาดไม่เท่ากับศูนย์ — ข้อมูลน้อยแสดง Insufficient Data</li>
              <li>• Coverage แยกจาก Confidence — ครบแค่ไหน กับ เชื่อถือได้แค่ไหน</li>
              <li>• ระงับ/เพิกถอนแยกจาก Band — ร้านที่ถูกเพิกถอนใช้ Badge ไม่ได้แม้ Band สูง</li>
              <li>• ราคาถูกหรือแพงไม่ใช่หลักฐานการทุจริต</li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="ความสามารถที่เพิ่มจากระบบคุ้มครองผู้บริโภคเดิม" icon={Database} />
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs text-ink-soft">
                  <tr>
                    <th className="py-1.5 font-medium">ด้าน</th>
                    <th className="py-1.5 font-medium">Consumer Protection (เดิม)</th>
                    <th className="py-1.5 font-medium">Marketplace & Trust Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-ink">
                  <tr>
                    <td className="py-2">แหล่งข้อมูล</td>
                    <td className="py-2">ข้อมูลที่ร้านแจ้ง + การตรวจของเจ้าหน้าที่</td>
                    <td className="py-2">เพิ่มข้อมูลการขาย ราคา และรีวิวจาก Marketplace (จำลอง)</td>
                  </tr>
                  <tr>
                    <td className="py-2">การประเมิน</td>
                    <td className="py-2">เกณฑ์ผ่าน/ไม่ผ่านต่อระดับ</td>
                    <td className="py-2">5 มิติ + Risk Adjustment + Coverage/Confidence</td>
                  </tr>
                  <tr>
                    <td className="py-2">การตัดสิน</td>
                    <td className="py-2">เจ้าหน้าที่ตาม Checklist</td>
                    <td className="py-2">เจ้าหน้าที่ตามเดิม พร้อมข้อมูลประกอบที่อธิบายได้</td>
                  </tr>
                  <tr>
                    <td className="py-2">ผู้บริโภค</td>
                    <td className="py-2">สถานะร้านและใบรับรอง</td>
                    <td className="py-2">เพิ่ม Band, Coverage, Confidence และร้านบน Marketplace</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <Card>
          <CardHeader title="เส้นทางการสาธิต Marketplace & Trust Assessment" />
          <ol className="space-y-3 p-4">
            {path.map((sc) => {
              const done = d.completed.includes(sc.id);
              return (
                <li key={sc.id} className="flex gap-3">
                  {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : sc.branch ? <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-info" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-line" />}
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {scenarioCode(sc)}. {sc.title}
                      {sc.branch && <span className="ml-1 text-xs font-normal text-info">(ทางเลือก)</span>}
                      {done && (
                        <Link to={`/demo/complete/${sc.id}`} className="ml-2 text-xs font-normal text-primary hover:underline">
                          ดูสรุป
                        </Link>
                      )}
                    </p>
                    <p className="text-sm text-ink-soft">{sc.keyMessage}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card>
          <CardHeader title="ข้อจำกัดและสิ่งที่ต้องทำก่อนใช้งานจริง" icon={HelpCircle} />
          <ul className="grid gap-2 p-4 text-sm text-ink sm:grid-cols-2">
            <li>• การเชื่อมต่อจริงต้องมีข้อตกลงกับแพลตฟอร์ม และขอความยินยอมตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล</li>
            <li>• น้ำหนัก เกณฑ์ และช่วงราคาอ้างอิงต้องปรับเทียบกับข้อมูลจริงก่อนใช้</li>
            <li>• ต้องมีช่องทางให้ร้านค้าโต้แย้งผลประเมินและขอทบทวน</li>
            <li>• เจ้าหน้าที่ต้องได้รับการอบรมการอ่านผลและการตัดสินที่ต่างจากข้อเสนอของระบบ</li>
          </ul>
        </Card>

        <PrototypeDisclaimer />

        <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            icon={RotateCcw}
            onClick={async () => {
              const r = await confirmDialog({ title: 'เริ่ม Journey Marketplace & Trust ใหม่', body: 'ล้างข้อมูลทั้งหมดและเริ่ม Scenario 9 ใหม่', confirmText: 'เริ่มใหม่ทั้งหมด', tone: 'danger' });
              if (r.ok) startJourney(nav, 'v2');
            }}
          >
            Restart Journey
          </Button>
          <Button
            variant="outline"
            icon={SlidersHorizontal}
            onClick={() => {
              useSessionStore.getState().set({ role: 'admin', officerId: 'AD-001' });
              nav('/admin/assessment-model');
            }}
          >
            ดูโมเดลการประเมิน (ผู้ดูแลระบบ)
          </Button>
          <Button variant="outline" icon={Trophy} onClick={() => nav('/demo/overview')}>
            สรุปภาพรวม v1
          </Button>
          <Button variant="ghost" icon={LayoutGrid} onClick={() => nav('/demo')}>
            Back to Demo Menu
          </Button>
        </section>
      </main>
    </DemoFrame>
  );
}

function Fact({ icon: Icon, label, value, hint }: { icon: typeof Store; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-bg p-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
      {hint && <p className="font-mono text-[11px] text-ink-soft">{hint}</p>}
    </div>
  );
}

function Impact({ icon: Icon, cls, title, children }: { icon: typeof Store; cls: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className={cn('flex items-center gap-1.5 font-semibold', cls)}>
        <Icon className="h-4 w-4" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">{children}</ul>
    </Card>
  );
}
