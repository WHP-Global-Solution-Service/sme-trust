import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileCheck,
  FileWarning,
  Layers,
  Link2,
  Play,
  RotateCcw,
  Scale,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Merchant, Role } from '@/types';
import type { AssessmentBadge } from '@/features/automation/types';
import { confirmDialog, toast, useAssessmentBadgeStore, useMerchantStore, useSessionStore } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { resetAllDemoData } from '@/stores/workflows';
import { findScenario } from '@/mock/scenarios';
import type { ScenarioDef } from '@/demo/types';
import { pauseDemo, resumeDemo, startScenario } from '@/demo/controller';
import { MAIN_CTA_LABEL, MAIN_JOURNEY_ID, OTHER_DEMO_IDS } from '@/demo/main';
import { switchRole } from '@/components/layout/demo';
import { isPublicMerchant } from '@/utils/trust';
import { Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { DemoFrame, PrototypeDisclaimer } from './DemoFrame';

export const BENEFIT_ROWS: { key: keyof ScenarioDef['benefits']; label: string; icon: LucideIcon; cls: string }[] = [
  { key: 'sme', label: 'SME', icon: Store, cls: 'text-primary' },
  { key: 'consumer', label: 'ผู้บริโภค', icon: User, cls: 'text-info' },
  { key: 'ocpb', label: 'สคบ.', icon: ShieldCheck, cls: 'text-secondary' },
];

// ---------------------------------------------------------------- Demo content
export { MAIN_JOURNEY_ID, MAIN_CTA_LABEL };

/** ขั้นตอนของ Demo หลัก → ขั้นในตัวควบคุมการสาธิต (ขั้น "ประเมิน" และ "แสดงผล Badge" อยู่ในหน้าผลประเมินเดียวกัน) */
export const RECOMMENDED_FLOW: { icon: LucideIcon; title: string; steps: string[] }[] = [
  { icon: Link2, title: 'เชื่อมข้อมูลร้านค้า', steps: ['s9a-home', 's9a-entry', 's9a-authorize', 's9a-shop', 's9a-import'] },
  { icon: FileCheck, title: 'ลงทะเบียน', steps: ['s9a-review', 's9a-missing', 's9a-submit'] },
  { icon: CheckCircle2, title: 'ตรวจสอบอัตโนมัติ', steps: ['s9a-auto'] },
  { icon: BarChart3, title: 'ประเมินความน่าเชื่อถือ', steps: ['s9a-assess'] },
  { icon: BadgeCheck, title: 'แสดงผล Badge', steps: ['s9a-assess'] },
  { icon: SearchCheck, title: 'ผู้บริโภคตรวจสอบ', steps: ['s9a-consumer'] },
];

/** มุมมองโดยตรงจากข้อมูลจำลองที่มีอยู่ (ไม่เริ่มการสาธิตใหม่ และไม่สร้างผลประเมินใหม่) */
export type DirectView = 'assessment' | 'badge' | 'consumer' | 'request_info' | 'exceptions';

/** กรณีพิเศษที่ยังจำเป็น — ใช้กระบวนการจริงของระบบ */
export const SPECIAL_CASES: { key: string; icon: LucideIcon; scenario: string; desc: string; view?: DirectView; viewLabel?: string; viewNote?: string }[] = [
  {
    key: 'insufficient',
    icon: FileWarning,
    scenario: 's9b',
    desc: 'ร้านที่ขายผ่านช่องทางอื่นลงทะเบียนด้วยตนเองได้ และผ่านการลงทะเบียน แต่ข้อมูลการขายยังไม่พอแสดง Badge — ระบบแสดงสถานะ "ข้อมูลยังไม่เพียงพอ" และแนะนำสิ่งที่ร้านควรเพิ่มเอง โดยไม่ส่งงานให้เจ้าหน้าที่',
    view: 'request_info',
    viewLabel: 'ดูร้านที่ข้อมูลยังไม่เพียงพอ',
    viewNote: 'ร้านตัวอย่างจากข้อมูลตั้งต้น — แสดงผลประเมิน "ข้อมูลยังไม่เพียงพอ" ไม่ใช่ผลการตรวจคำขอลงทะเบียน',
  },
  {
    key: 'mismatch',
    icon: UserCheck,
    scenario: 's15',
    desc: 'เจ้าของบัญชีร้านบน Marketplace ไม่ตรงกับผู้ยืนยันตัวตน ระบบส่งเข้าคิวงานของเจ้าหน้าที่พร้อมเหตุผล เจ้าหน้าที่ตัดสินแล้วระบบทำงานต่อเอง',
    view: 'exceptions',
    viewLabel: 'เปิดคิวงานเจ้าหน้าที่',
  },
  {
    key: 'suspended',
    icon: Scale,
    scenario: 's6',
    desc: 'เจ้าหน้าที่พิจารณาหลักฐานและระงับการรับรอง ร้านค้าชี้แจงและอุทธรณ์ได้ตามขั้นตอน — สถานะต่อสาธารณะเปลี่ยนตามผลจริง',
  },
];

/** ผลลัพธ์ที่เปิดดูได้ทันทีจากข้อมูลจำลองที่มีอยู่ */
export const RESULT_VIEWS: { icon: LucideIcon; title: string; desc: string; view: DirectView; viewLabel: string }[] = [
  { icon: BarChart3, title: 'ผลประเมินความน่าเชื่อถือ', desc: 'ผลประเมิน 5 ด้าน ระดับ Band เหตุผล และสิ่งที่ควรปรับปรุง (มุมร้านค้า)', view: 'assessment', viewLabel: 'ดูผลประเมินร้านตัวอย่าง' },
  { icon: BadgeCheck, title: 'Assessment Badge', desc: 'Badge ที่ระบบแสดงอัตโนมัติเมื่อผ่านเงื่อนไข — ผลประเมิน ไม่ใช่ใบรับรองของ สคบ.', view: 'badge', viewLabel: 'ดู Badge ของร้านตัวอย่าง' },
  { icon: SearchCheck, title: 'ผู้บริโภคตรวจสอบร้านค้า', desc: 'ค้นหาร้านค้าและตรวจสอบสถานะก่อนซื้อ โดยไม่ต้องเข้าสู่ระบบ', view: 'consumer', viewLabel: 'เปิดหน้าตรวจสอบร้านค้า' },
];

export const OTHER_DEMOS: readonly string[] = OTHER_DEMO_IDS;

/** ร้านตัวอย่างจากข้อมูลปัจจุบัน (คำนวณด้วยกฎเดิมของระบบ) — ใช้ร้านตั้งต้นก่อน ถ้าข้อมูลเปลี่ยนใช้ร้านอื่นที่มีสถานะเดียวกัน · ไม่มี → undefined (ไม่สร้างข้อมูลแทน) */
export function exampleShop(kind: 'active' | 'request_info', badges: AssessmentBadge[], merchants: Merchant[]): Merchant | undefined {
  const preferred = kind === 'active' ? 'M-001' : 'M-002';
  const fits = (x: AssessmentBadge) => (kind === 'active' ? x.status === 'active' : x.route === 'AUTO_REQUEST_INFO' && x.status === 'insufficient');
  const ids = badges.filter(fits).map((x) => x.merchantId).sort((a, c) => (a === preferred ? -1 : c === preferred ? 1 : a.localeCompare(c)));
  for (const id of ids) {
    const m = merchants.find((x) => x.id === id);
    if (m && isPublicMerchant(m)) return m;
  }
  return undefined;
}

/** หน้า Demo — Demo หลักเส้นเดียว · กรณีพิเศษ · ผลลัพธ์โดยตรงและฟังก์ชันอื่นพับเก็บไว้ */
export default function DemoScenariosPage() {
  const nav = useNavigate();
  const d = useDemoStore();
  const active = findScenario(d.activeScenario);
  const inProgress = !!active && (d.status === 'running' || d.status === 'paused');
  const main = findScenario(MAIN_JOURNEY_ID)!;
  const badges = useAssessmentBadgeStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const activeShop = exampleShop('active', badges, merchants);
  const infoShop = exampleShop('request_info', badges, merchants);

  /** เริ่มการสาธิต — ถ้ามีการสาธิตค้างอยู่ต้องยืนยันก่อน (ไม่ล้างความคืบหน้าแบบเงียบ) */
  const start = async (sc: ScenarioDef) => {
    // เล่นซ้ำ: แจ้งก่อนว่าร้านจากการเล่นครั้งก่อนของบัญชีตัวอย่างจะถูกล้าง (ไม่ล้างแบบเงียบ)
    const note = sc.replayNote?.();
    if (inProgress || note) {
      const r = await confirmDialog({
        title: `เริ่ม "${sc.title}"?`,
        body: [inProgress ? `การสาธิตที่ค้างอยู่ ("${active!.title}") จะหยุด และข้อมูลสาธิตกลับเป็นจุดเริ่มต้นของเรื่องที่เลือก` : '', note ?? ''].filter(Boolean).join(' · '),
        confirmText: 'เริ่มตั้งแต่ต้น',
      });
      if (!r.ok) return;
    }
    startScenario(sc.id, nav);
    toast.success(`เริ่ม "${sc.title}"`, 'ตัวควบคุมการสาธิตจะพาไปทีละขั้น');
  };
  const startById = (id: string) => {
    const sc = findScenario(id);
    if (sc) void start(sc);
  };

  /** ปลายทางของมุมมองโดยตรง — undefined เมื่อไม่มีร้านตัวอย่างในข้อมูลปัจจุบัน */
  const viewTarget = (v: DirectView): { role: Role; path: string; shop?: Merchant } | undefined => {
    if (v === 'consumer') return { role: 'consumer', path: '/check' };
    if (v === 'exceptions') return { role: 'officer', path: '/o/exceptions' };
    const shop = v === 'request_info' ? infoShop : activeShop;
    if (!shop) return undefined;
    return v === 'assessment' ? { role: 'merchant', path: '/m/trust', shop } : { role: 'consumer', path: `/shop/${shop.id}`, shop };
  };
  /** เปิดผลลัพธ์โดยตรง — ไม่เริ่มการสาธิตใหม่ ไม่เปลี่ยนข้อมูลสาธิต · การสาธิตที่ค้างอยู่ถูกหยุดชั่วคราว (กด "สาธิตต่อ" กลับมาได้) */
  const openView = (v: DirectView) => {
    const t = viewTarget(v);
    if (!t) return;
    if (inProgress && d.status === 'running') pauseDemo();
    if (t.role === 'merchant' && t.shop) useSessionStore.getState().set({ role: 'merchant', operatorId: t.shop.operatorId, activeMerchantId: t.shop.id, merchantLoggedIn: true });
    else switchRole(t.role);
    nav(t.path);
  };

  return (
    <DemoFrame>
      {/* ---------------- Hero: Primary Action เดียว ---------------- */}
      <section className="bg-primary text-white" data-testid="demo-hero">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            ระบบต้นแบบ · ข้อมูลจำลอง
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">ทดลองใช้งาน SME Trust</h1>
          <p className="mt-2 max-w-2xl text-white/85">สาธิตตั้งแต่เชื่อมข้อมูลร้านค้า ลงทะเบียน ตรวจสอบอัตโนมัติ ประเมินความน่าเชื่อถือ จนผู้บริโภคตรวจสอบร้านเดียวกันได้</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="inverse" size="lg" icon={Play} onClick={() => void start(main)} data-testid="main-cta">
              {MAIN_CTA_LABEL}
            </Button>
            <p className="text-sm text-white/80">ไม่ต้องเลือกเรื่อง · ตัวควบคุมการสาธิตบอกทุกขั้นว่าต้องกดอะไรต่อ</p>
          </div>
          {inProgress && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white/10 p-4 sm:flex-row sm:items-center" data-testid="demo-resume">
              <p className="flex-1 text-sm">
                {d.status === 'paused' ? 'หยุดไว้ที่' : 'กำลังสาธิต'} <b>{active!.title}</b> · ขั้นที่ {d.stepIndex + 1}/{active!.steps.length}
              </p>
              <Button variant="inverseOutline" icon={Play} onClick={() => resumeDemo(nav)}>
                สาธิตต่อ
              </Button>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {/* ---------------- สิ่งที่จะได้เห็นใน Demo หลัก ---------------- */}
        <section aria-labelledby="main-heading" className="rounded-card border-2 border-primary/30 bg-white p-5 shadow-card" data-testid="main-journey">
          <SectionHead id="main-heading" title="สิ่งที่จะได้เห็นใน Demo หลัก" sub="ใช้ร้านค้าเดียวกันตลอดทุกขั้น — กดปุ่มด้านบนครั้งเดียว ตัวควบคุมการสาธิตพาไปจนจบ" flush />
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6" data-testid="recommended-flow">
            {RECOMMENDED_FLOW.map((s, i) => (
              <li key={s.title} className="relative flex items-center gap-2 rounded-xl bg-bg p-2.5 sm:gap-3 sm:p-3 lg:flex-col lg:text-center">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white sm:h-10 sm:w-10">
                  <s.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <span className="text-sm font-semibold leading-snug text-ink">
                  <span className="text-primary">{i + 1}.</span> {s.title}
                </span>
                {i < RECOMMENDED_FLOW.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-ink-soft lg:block" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-soft">ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่ · ไม่ออกใบรับรองให้อัตโนมัติ · ถ้าข้อมูลร้านยังไม่พอหรือยังไม่ผ่านเงื่อนไข ระบบแสดงสถานะจริงแทน Badge</p>
        </section>

        {/* ---------------- กรณีพิเศษ ---------------- */}
        <section aria-labelledby="case-heading" data-testid="case-section">
          <SectionHead id="case-heading" title="กรณีพิเศษ (เฉพาะกรณีจำเป็น)" sub="เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ — ไม่ใช่ขั้นตอนของร้านค้าปกติ" />
          <div className="grid gap-4 md:grid-cols-3">
            {SPECIAL_CASES.map((c) => {
              const sc = findScenario(c.scenario)!;
              const target = c.view ? viewTarget(c.view) : undefined;
              return (
                <article key={c.key} className="flex flex-col rounded-card border border-line bg-white p-4 shadow-card" data-testid="case-card">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary-50 text-secondary">
                      <c.icon className="h-6 w-6" />
                    </span>
                    <h3 className="font-bold leading-snug text-ink">{sc.title}</h3>
                  </div>
                  <p className="mt-2 flex-1 text-sm text-ink-soft">{c.desc}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={Play} aria-label={`ทดลองกรณีนี้: ${sc.title}`} onClick={() => startById(c.scenario)}>
                      ทดลองกรณีนี้
                    </Button>
                    {c.view && (
                      <Button size="sm" variant="outline" icon={Eye} disabled={!target} aria-label={`${c.viewLabel}: ${sc.title}`} onClick={() => openView(c.view!)} data-testid="direct-view">
                        {c.viewLabel}
                      </Button>
                    )}
                  </div>
                  {target && c.viewNote && <p className="mt-2 text-xs text-ink-soft" data-testid="view-note">{c.viewNote}</p>}
                  {c.view && !target && <p className="mt-2 text-xs text-ink-soft">ไม่พบร้านตัวอย่างในข้อมูลปัจจุบัน — รีเซ็ตข้อมูลสาธิตได้ในส่วน "ฟังก์ชันอื่นของระบบ"</p>}
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------------- ผลลัพธ์และฟังก์ชันอื่น (พับเก็บ) ---------------- */}
        <section aria-labelledby="more-heading" className="space-y-3" data-testid="secondary-section">
          <SectionHead id="more-heading" title="ดูเพิ่มเติม" sub="เปิดดูผลลัพธ์ได้ทันทีโดยไม่ต้องเริ่ม Demo ใหม่ หรือสาธิตฟังก์ชันอื่นของระบบ" />
          <Collapsible testId="results-section" summary={<><Eye className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1">ดูผลลัพธ์โดยตรง</span><span className="hidden text-xs font-normal text-ink-soft sm:inline">ผลประเมิน · Badge · การตรวจสอบของผู้บริโภค</span></>}>
            <ul className="divide-y divide-line">
              {RESULT_VIEWS.map((r) => {
                const target = viewTarget(r.view);
                return (
                  <li key={r.title} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid="result-view">
                    <r.icon className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{r.title}</p>
                      <p className="text-xs text-ink-soft">{r.desc}</p>
                      {target?.shop && <p className="text-xs text-ink-soft">ร้านตัวอย่าง: {target.shop.shopName} (ข้อมูลจำลอง)</p>}
                      {!target && <p className="text-xs text-ink-soft">ไม่พบร้านตัวอย่างในข้อมูลปัจจุบัน — รีเซ็ตข้อมูลสาธิตได้ในส่วน "ฟังก์ชันอื่นของระบบ"</p>}
                    </div>
                    <Button size="sm" variant="secondary" icon={Eye} disabled={!target} aria-label={`${r.viewLabel}: ${r.title}`} onClick={() => openView(r.view)} data-testid="direct-view">
                      {r.viewLabel}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Collapsible>
          <Collapsible testId="other-demos" summary={<><Layers className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1">ฟังก์ชันอื่นของระบบ</span><span className="hidden text-xs font-normal text-ink-soft sm:inline">{OTHER_DEMOS.length} เรื่อง</span></>}>
            <ul className="divide-y divide-line">
              {OTHER_DEMOS.map((id) => {
                const sc = findScenario(id)!;
                return (
                  <li key={id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid="other-demo">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{sc.title}</p>
                      <p className="text-xs text-ink-soft">{sc.objective}</p>
                    </div>
                    <Button size="sm" variant="outline" icon={Play} aria-label={`เริ่มสาธิต: ${sc.title}`} onClick={() => startById(id)}>
                      เริ่มสาธิต
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex flex-col items-start gap-3 rounded-xl bg-bg p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-ink-soft">ทุกการเริ่มสาธิตคืนข้อมูลเป็นจุดเริ่มต้นของเรื่องนั้นเสมอ — ใช้ปุ่มนี้เมื่อต้องการล้างข้อมูลสาธิตทั้งหมด</p>
              <Button
                variant="outline"
                icon={RotateCcw}
                onClick={async () => {
                  const r = await confirmDialog({ title: 'รีเซ็ตข้อมูลสาธิตทั้งหมด', body: 'ล้างข้อมูลที่เปลี่ยนแปลงทั้งหมดและกลับเป็นข้อมูลตั้งต้น', confirmText: 'รีเซ็ตข้อมูล', tone: 'danger' });
                  if (!r.ok) return;
                  resetAllDemoData();
                  toast.success('รีเซ็ตข้อมูลสาธิตทั้งหมดแล้ว');
                }}
              >
                รีเซ็ตข้อมูลสาธิตทั้งหมด
              </Button>
            </div>
          </Collapsible>
        </section>

        {/* ---------------- ขอบเขต + Disclaimer ---------------- */}
        <section aria-label="ขอบเขตของระบบสาธิต" className="grid gap-3 sm:grid-cols-3" data-testid="scope-legend">
          {[
            ['MVP', 'ระบบหลักที่เสนอให้เริ่มทดลองใช้ (Pilot)'],
            ['Prototype', 'ทุกระบบในหน้านี้เป็นต้นแบบที่ใช้ข้อมูลจำลอง'],
            ['Future Integration', 'เชื่อม Shopee/Lazada, e-KYC และฐานข้อมูลกลางจริง — ต้องพัฒนาและขอความร่วมมือ'],
          ].map(([h, t]) => (
            <div key={h} className="rounded-xl border border-line bg-white p-4">
              <p className="text-sm font-bold text-ink">{h}</p>
              <p className="mt-1 text-sm text-ink-soft">{t}</p>
            </div>
          ))}
        </section>
        <PrototypeDisclaimer />
      </main>
    </DemoFrame>
  );
}

function SectionHead({ id, title, sub, flush = false }: { id: string; title: string; sub: string; flush?: boolean }) {
  return (
    <div className={flush ? '' : 'mb-4'}>
      <h2 id={id} className="text-xl font-bold text-ink">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>
    </div>
  );
}

/** ส่วนพับเก็บ (ค่าเริ่มต้นพับ) — ใช้ <details> ของเบราว์เซอร์ */
function Collapsible({ summary, children, testId, className }: { summary: ReactNode; children: ReactNode; testId: string; className?: string }) {
  return (
    <details className={cn('group rounded-card border border-line bg-white shadow-card', className)} data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}
