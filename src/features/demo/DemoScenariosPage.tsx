import { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Eye,
  FileCheck,
  FileWarning,
  GitBranch,
  GraduationCap,
  Layers,
  LineChart,
  Link2,
  MessageSquareWarning,
  Play,
  PlayCircle,
  RotateCcw,
  Route,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  User,
  UserCheck,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Merchant, Role } from '@/types';
import type { AssessmentBadge } from '@/features/automation/types';
import { confirmDialog, toast, useAssessmentBadgeStore, useMerchantStore, useSessionStore } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { resetAllDemoData } from '@/stores/workflows';
import { findScenario, journeyScenarios, scenarioCode, trackOf, trackScenarios, TRACK_INFO } from '@/mock/scenarios';
import type { ScenarioDef, Track } from '@/demo/types';
import { pauseDemo, resetScenarioData, resumeDemo, scenarioStatus, startJourney, startScenario } from '@/demo/controller';
import { switchRole } from '@/components/layout/demo';
import { isPublicMerchant } from '@/utils/trust';
import { Badge, Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { DemoFrame, PrototypeDisclaimer } from './DemoFrame';
import { useScenarioLauncher } from './ScenarioLauncher';

export const AUDIENCE: Record<Role, { label: string; icon: LucideIcon; cls: string }> = {
  merchant: { label: 'ผู้ประกอบการ', icon: Store, cls: 'bg-primary-50 text-primary' },
  consumer: { label: 'ผู้บริโภค', icon: User, cls: 'bg-info-50 text-info' },
  officer: { label: 'เจ้าหน้าที่', icon: Building2, cls: 'bg-secondary-50 text-secondary' },
  admin: { label: 'ผู้บริหาร/ผู้ดูแลระบบ', icon: UserCog, cls: 'bg-slate-100 text-slate-700' },
};

export const BENEFIT_ROWS: { key: keyof ScenarioDef['benefits']; label: string; icon: LucideIcon; cls: string }[] = [
  { key: 'sme', label: 'SME', icon: Store, cls: 'text-primary' },
  { key: 'consumer', label: 'ผู้บริโภค', icon: User, cls: 'text-info' },
  { key: 'ocpb', label: 'สคบ.', icon: ShieldCheck, cls: 'text-secondary' },
];

const STATUS_CHIP = {
  completed: { label: 'Completed', tone: 'success' as const, icon: CheckCircle2 },
  current: { label: 'Current', tone: 'primary' as const, icon: PlayCircle },
  not_started: { label: 'Not Started', tone: 'neutral' as const, icon: Circle },
};

// ---------------------------------------------------------------- Demo content (เส้นทางหลักเส้นเดียว)
/** เส้นทางหลักเส้นเดียว — Scenario 9A (Logic เดิมทั้งหมด): ลงทะเบียน → ตรวจสอบอัตโนมัติ → AUTO_PASS → ประเมิน → Badge ตามเงื่อนไข → ผู้บริโภคตรวจสอบ */
export const MAIN_JOURNEY_ID = 's9a';
export const MAIN_CTA_LABEL = 'ทดลองกระบวนการ SME Trust ตั้งแต่ต้น';

/** 6 ขั้นของเส้นทางหลัก → ขั้นของ Scenario 9A ในตัวควบคุมการสาธิต (ขั้น 4–5 แสดงในหน้าผลประเมินเดียวกัน) */
export const RECOMMENDED_FLOW: { icon: LucideIcon; title: string; steps: string[] }[] = [
  { icon: Link2, title: 'ลงทะเบียนร้านค้า', steps: ['s9a-home', 's9a-entry', 's9a-authorize', 's9a-shop', 's9a-import', 's9a-review', 's9a-missing'] },
  { icon: FileCheck, title: 'ตรวจสอบอัตโนมัติ', steps: ['s9a-submit'] },
  { icon: CheckCircle2, title: 'AUTO_PASS', steps: ['s9a-auto'] },
  { icon: BarChart3, title: 'ประเมินความน่าเชื่อถือ', steps: ['s9a-assess'] },
  { icon: BadgeCheck, title: 'แสดงผล Badge ตามเงื่อนไข', steps: ['s9a-assess'] },
  { icon: SearchCheck, title: 'ผู้บริโภคตรวจสอบ', steps: ['s9a-consumer'] },
];

/** A. Demo หลัก — ส่วนหนึ่งของเส้นทางหลัก (ไม่มีปุ่มเริ่มแยก จึงไม่เริ่ม Journey ซ้ำ) · flow = ลำดับขั้นใน RECOMMENDED_FLOW (1-based) */
export const MAIN_HIGHLIGHTS: { icon: LucideIcon; title: string; desc: string; flow: number[] }[] = [
  { icon: Store, title: 'ลงทะเบียนและเชื่อม Marketplace', desc: 'เติมข้อมูลจากร้านค้าออนไลน์ ระบบตรวจคำขอและผ่านการลงทะเบียนทันทีเมื่อข้อมูลครบ', flow: [1, 2, 3] },
  { icon: BarChart3, title: 'ประเมินอัตโนมัติ', desc: 'ระบบประเมินความน่าเชื่อถือ และแสดง Badge เมื่อผ่านเงื่อนไข', flow: [4, 5] },
  { icon: SearchCheck, title: 'ผู้บริโภคตรวจสอบ', desc: 'ผู้บริโภคเห็นผลประเมินหรือสถานะจริงของร้านเดียวกัน', flow: [6] },
];

/** มุมมองโดยตรงจากข้อมูลจำลองที่มีอยู่ (ไม่เริ่ม Scenario และไม่สร้างผลประเมินใหม่) */
export type DirectView = 'assessment' | 'badge' | 'consumer' | 'request_info' | 'exceptions';

/** B. Demo เฉพาะกรณี — ใช้ Scenario เดิม + มุมมองโดยตรง */
export const SPECIAL_CASES: { key: string; icon: LucideIcon; route: string; title: string; desc: string; example: string; scenario: string; view: DirectView; viewLabel: string; viewNote?: string }[] = [
  {
    key: 'request-info',
    icon: FileWarning,
    route: 'AUTO_REQUEST_INFO',
    title: 'ข้อมูลยังไม่พอ — ร้านเพิ่มข้อมูลเอง',
    desc: 'ระบบแจ้งสิ่งที่ต้องเพิ่มให้ร้านค้า โดยไม่สร้างงานให้เจ้าหน้าที่',
    example: 'ตัวอย่างจาก Scenario 9B: ร้านที่ไม่มี Marketplace ลงทะเบียนด้วยตนเอง ผ่านการลงทะเบียน แต่ข้อมูลการขายยังไม่พอแสดง Badge',
    scenario: 's9b',
    view: 'request_info',
    viewLabel: 'ดูร้านที่ข้อมูลยังไม่เพียงพอ',
    viewNote: 'ร้านตัวอย่างจากข้อมูลตั้งต้น — แสดงผลประเมิน "ข้อมูลยังไม่เพียงพอ" ไม่ใช่ผลการตรวจคำขอลงทะเบียน',
  },
  {
    key: 'manual-review',
    icon: UserCheck,
    route: 'MANUAL_REVIEW',
    title: 'พบความผิดปกติ — เจ้าหน้าที่ตรวจ',
    desc: 'เช่น เจ้าของบัญชีร้านไม่ตรงกับผู้ยืนยันตัวตน ระบบส่งเข้า Officer Exception Queue พร้อมเหตุผล',
    example: 'Scenario 15: ข้อมูลตัวตนขัดแย้ง → เจ้าหน้าที่ตัดสิน → ระบบดำเนินการต่อเอง',
    scenario: 's15',
    view: 'exceptions',
    viewLabel: 'เปิด Exception Queue',
  },
];

/** C. ผลลัพธ์ — เปิดดูโดยตรงก่อน · ดูแบบทีละขั้นด้วย Scenario เดิมได้ (ไม่บังคับ) */
export const RESULT_VIEWS: { icon: LucideIcon; title: string; desc: string; view: DirectView; viewLabel: string; scenario: string }[] = [
  { icon: BarChart3, title: 'Trust Assessment', desc: 'ผลประเมิน 5 ด้าน ระดับ Band เหตุผล และสิ่งที่ควรปรับปรุง (มุมร้านค้า)', view: 'assessment', viewLabel: 'ดูผลประเมินร้านตัวอย่าง', scenario: 's11' },
  { icon: BadgeCheck, title: 'Assessment Badge', desc: 'Badge ที่ระบบแสดงอัตโนมัติเมื่อผ่านเงื่อนไข — ผลประเมิน ไม่ใช่ใบรับรองของ สคบ.', view: 'badge', viewLabel: 'ดู Badge ของร้านตัวอย่าง', scenario: 's14' },
  { icon: SearchCheck, title: 'Consumer Verification', desc: 'ค้นหาร้านค้าและตรวจสอบสถานะก่อนซื้อ โดยไม่ต้องเข้าสู่ระบบ', view: 'consumer', viewLabel: 'เปิดหน้าตรวจสอบร้านค้า', scenario: 's13' },
];

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

/** ระบบเพิ่มเติม — จัดกลุ่มจาก Scenario ที่มีอยู่จริง (แต่ละ Scenario อยู่กลุ่มเดียว ไม่ซ้ำกับระบบหลัก) */
export const SECONDARY_GROUPS: { title: string; icon: LucideIcon; ids: string[] }[] = [
  { title: 'ระบบร้องเรียนและอุทธรณ์', icon: MessageSquareWarning, ids: ['s4', 's6'] },
  { title: 'AI Simulation', icon: Bot, ids: ['s7', 's8'] },
  { title: 'คำเตือน การอบรม และการปฏิบัติตามเกณฑ์', icon: GraduationCap, ids: ['s5'] },
  { title: 'การรับรองระดับเพิ่มเติม', icon: Award, ids: ['s2', 's12'] },
  { title: 'Marketplace Intelligence ขั้นสูง', icon: LineChart, ids: ['s9', 's10'] },
  { title: 'Scenario อื่น ๆ', icon: Layers, ids: ['s1', 's3'] },
];

/** หน้า Demo — MVP-First Demo Center: ระบบหลักก่อน · เส้นทางแนะนำ · ระบบเพิ่มเติมและ Scenario ทั้งหมดพับเก็บไว้ด้านล่าง */
export default function DemoScenariosPage() {
  const nav = useNavigate();
  const d = useDemoStore();
  const { launch, dialog } = useScenarioLauncher();
  const active = findScenario(d.activeScenario);
  const inProgress = !!active && (d.status === 'running' || d.status === 'paused');
  const [params] = useSearchParams();
  const asked = params.get('track');
  // ?track=v1|v2 (ลิงก์เดิมจากหน้าแรก) เปิดส่วน "ดู Scenario ทั้งหมด" ที่ชุดนั้น — ไม่เช่นนั้นใช้ชุดที่กำลังสาธิตอยู่
  const [tab, setTab] = useState<Track>(() => (asked === 'v1' || asked === 'v2' ? asked : d.journeyMode ? d.journeyTrack ?? 'v1' : active ? trackOf(active) : 'v1'));
  const [allOpen, setAllOpen] = useState(asked === 'v1' || asked === 'v2');
  const main = findScenario(MAIN_JOURNEY_ID)!;
  const badges = useAssessmentBadgeStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const activeShop = exampleShop('active', badges, merchants);
  const infoShop = exampleShop('request_info', badges, merchants);
  /** ปลายทางของมุมมองโดยตรง — undefined เมื่อไม่มีร้านตัวอย่างในข้อมูลปัจจุบัน */
  const viewTarget = (v: DirectView): { role: Role; path: string; shop?: Merchant } | undefined => {
    if (v === 'consumer') return { role: 'consumer', path: '/check' };
    if (v === 'exceptions') return { role: 'officer', path: '/o/exceptions' };
    const shop = v === 'request_info' ? infoShop : activeShop;
    if (!shop) return undefined;
    return v === 'assessment' ? { role: 'merchant', path: '/m/trust', shop } : { role: 'consumer', path: `/shop/${shop.id}`, shop };
  };
  /** เปิดผลลัพธ์โดยตรง — ไม่เริ่ม Scenario ไม่เปลี่ยนข้อมูลสาธิต · การสาธิตที่ค้างอยู่ถูกหยุดชั่วคราว (กด "สาธิตต่อ" กลับมาได้) */
  const openView = (v: DirectView) => {
    const t = viewTarget(v);
    if (!t) return;
    if (inProgress && d.status === 'running') pauseDemo();
    if (t.role === 'merchant' && t.shop) useSessionStore.getState().set({ role: 'merchant', operatorId: t.shop.operatorId, activeMerchantId: t.shop.id, merchantLoggedIn: true });
    else switchRole(t.role);
    nav(t.path);
  };

  const startSingle = async (sc: ScenarioDef) => {
    if (d.journeyMode && inProgress) {
      const r = await confirmDialog({ title: `เริ่ม Scenario ${scenarioCode(sc)} แบบเดี่ยว?`, body: 'การเริ่มแบบเดี่ยวจะรีเซ็ตข้อมูลสาธิตและออกจาก Full Journey ที่ค้างอยู่', confirmText: 'เริ่มแบบเดี่ยว' });
      if (!r.ok) return;
    }
    startScenario(sc.id, nav);
    toast.success(`เริ่ม Scenario ${scenarioCode(sc)}`, 'ใช้ตัวควบคุมการสาธิตเพื่อไปทีละขั้น');
  };
  const startById = (id: string) => {
    const sc = findScenario(id);
    if (sc) void startSingle(sc);
  };
  /** เริ่มเส้นทางหลักตั้งแต่ขั้นแรก — ถ้ากำลังสาธิตอยู่ต้องยืนยันก่อน (ไม่ล้างความคืบหน้าแบบเงียบ) */
  const startMainFromBeginning = async () => {
    if (inProgress && !d.journeyMode) {
      const r = await confirmDialog({ title: 'เริ่มเส้นทางหลักตั้งแต่ต้น?', body: 'ข้อมูลสาธิตจะกลับเป็นจุดเริ่มต้นของเส้นทางหลัก และการสาธิตที่ค้างอยู่จะหยุด', confirmText: 'เริ่มตั้งแต่ต้น' });
      if (!r.ok) return;
    }
    void startSingle(main);
  };

  return (
    <DemoFrame>
      {/* ---------------- Hero ---------------- */}
      <section className="bg-primary text-white" data-testid="demo-hero">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            เส้นทางหลักเส้นเดียว
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">ทดลองใช้งาน SME Trust</h1>
          <p className="mt-2 max-w-2xl text-white/85">สาธิตการลงทะเบียนร้านค้า ประเมินความน่าเชื่อถือ และตรวจสอบผลผ่านระบบอัตโนมัติ</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="inverse" size="lg" icon={Play} onClick={startMainFromBeginning} data-testid="main-cta">
              {MAIN_CTA_LABEL}
            </Button>
            <p className="flex items-center gap-1.5 text-sm text-white/80">
              <Clock className="h-4 w-4" />
              {main.duration} · ร้านปกติไม่ต้องรอเจ้าหน้าที่
            </p>
          </div>
          {inProgress && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white/10 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm">
                {d.status === 'paused' ? 'หยุดไว้ที่' : 'กำลังสาธิต'} <b>Scenario {scenarioCode(active!)}: {active!.title}</b> · ขั้นที่ {d.stepIndex + 1}/{active!.steps.length}
              </p>
              <Button variant="inverseOutline" icon={Play} onClick={() => resumeDemo(nav)}>
                สาธิตต่อ
              </Button>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
        {/* ---------------- A. เส้นทางหลัก (Demo หลัก) ---------------- */}
        <section aria-labelledby="main-heading" className="rounded-card border-2 border-primary/30 bg-white p-5 shadow-card" data-testid="main-journey">
          <SectionHead id="main-heading" title="เส้นทางหลัก" sub={`กดปุ่ม "${MAIN_CTA_LABEL}" ครั้งเดียว ตัวควบคุมการสาธิตพาไปครบทุกขั้น`} flush />
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
          <h3 className="mt-6 text-sm font-bold text-ink">Demo หลักครอบคลุม</h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-3" data-testid="mvp-section">
            {MAIN_HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3 rounded-xl border border-line p-3" data-testid="mvp-card">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary">
                  <h.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-snug text-ink">{h.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{h.desc}</p>
                  <p className="mt-1 text-xs font-medium text-primary">ขั้นที่ {h.flow.length > 1 ? `${h.flow[0]}–${h.flow[h.flow.length - 1]}` : h.flow[0]} ของเส้นทางหลัก</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">ร้านปกติผ่านการลงทะเบียนอัตโนมัติโดยไม่ต้องรอเจ้าหน้าที่ · ถ้าข้อมูลร้านยังไม่พอหรือยังไม่ผ่านเงื่อนไข ระบบแสดงสถานะจริงแทน Badge</p>
        </section>

        {/* ---------------- B. Demo เฉพาะกรณี ---------------- */}
        <section aria-labelledby="case-heading" data-testid="case-section">
          <SectionHead id="case-heading" title="Demo เฉพาะกรณี" sub="เจ้าหน้าที่เข้ามาเฉพาะกรณีผิดปกติ — ไม่ใช่ขั้นตอนของร้านค้าปกติ" />
          <div className="grid gap-4 md:grid-cols-2">
            {SPECIAL_CASES.map((c) => {
              const target = viewTarget(c.view);
              return (
                <article key={c.key} className="flex flex-col rounded-card border border-line bg-white p-4 shadow-card" data-testid="case-card">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary-50 text-secondary">
                      <c.icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Badge tone="neutral">{c.route}</Badge>
                      <h3 className="mt-1 font-bold leading-snug text-ink">{c.title}</h3>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{c.desc}</p>
                  <p className="mt-2 flex-1 text-xs text-ink-soft">{c.example}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={Play} aria-label={`เริ่ม Demo: ${c.title}`} onClick={() => startById(c.scenario)}>
                      เริ่ม Demo
                    </Button>
                    <Button size="sm" variant="outline" icon={Eye} disabled={!target} aria-label={`${c.viewLabel}: ${c.title}`} onClick={() => openView(c.view)} data-testid="direct-view">
                      {c.viewLabel}
                    </Button>
                  </div>
                  {target && c.viewNote && <p className="mt-2 text-xs text-ink-soft" data-testid="view-note">{c.viewNote}</p>}
                  {!target && <p className="mt-2 text-xs text-ink-soft">ไม่พบร้านตัวอย่างในข้อมูลปัจจุบัน — Reset Demo Data ได้ในส่วน "ดู Scenario ทั้งหมด"</p>}
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------------- C. ผลลัพธ์และฟังก์ชันเพิ่มเติม (พับไว้) ---------------- */}
        <section aria-labelledby="secondary-heading" data-testid="secondary-section">
          <SectionHead id="secondary-heading" title="ผลลัพธ์และฟังก์ชันเพิ่มเติม" sub="เปิดดูผลลัพธ์จากข้อมูลจำลองได้ทันที โดยไม่ต้องเริ่ม Demo ใหม่" />
          <div className="space-y-3">
            <Collapsible testId="results-section" summary={<><Eye className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1">ดูผลลัพธ์โดยตรง</span><span className="hidden text-xs font-normal text-ink-soft sm:inline">Trust Assessment · Assessment Badge · Consumer Verification</span></>}>
              <ul className="divide-y divide-line">
                {RESULT_VIEWS.map((r) => {
                  const target = viewTarget(r.view);
                  const sc = findScenario(r.scenario)!;
                  return (
                    <li key={r.title} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid="result-view">
                      <r.icon className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{r.title}</p>
                        <p className="text-xs text-ink-soft">{r.desc}</p>
                        {target?.shop && <p className="text-xs text-ink-soft">ร้านตัวอย่าง: {target.shop.shopName} (ข้อมูลจำลอง)</p>}
                        {!target && <p className="text-xs text-ink-soft">ไม่พบร้านตัวอย่างในข้อมูลปัจจุบัน — ดูแบบทีละขั้นแทน หรือ Reset Demo Data</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" icon={Eye} disabled={!target} aria-label={`${r.viewLabel}: ${r.title}`} onClick={() => openView(r.view)} data-testid="direct-view">
                          {r.viewLabel}
                        </Button>
                        <Button size="sm" variant="ghost" icon={Play} aria-label={`ดูทีละขั้น (Scenario ${scenarioCode(sc)}): ${r.title}`} onClick={() => void startSingle(sc)}>
                          ดูทีละขั้น (Scenario {scenarioCode(sc)})
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Collapsible>
            <div className="grid gap-3 lg:grid-cols-2">
              {SECONDARY_GROUPS.map((g) => (
                <Collapsible key={g.title} testId="secondary-group" summary={<><g.icon className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1">{g.title}</span><span className="text-xs font-normal text-ink-soft">{g.ids.length} เรื่อง</span></>}>
                  <ul className="divide-y divide-line">
                    {g.ids.map((id) => {
                      const sc = findScenario(id)!;
                      return (
                        <li key={id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">{sc.title}</p>
                            <p className="truncate text-xs text-ink-soft">{sc.objective}</p>
                          </div>
                          <Button size="sm" variant="outline" icon={Play} aria-label={`เริ่มสาธิต: ${sc.title}`} onClick={() => void startSingle(sc)}>
                            เริ่มสาธิต
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </Collapsible>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- All scenarios (collapsed) ---------------- */}
        <Collapsible
          testId="all-scenarios"
          open={allOpen}
          onToggle={setAllOpen}
          className="border-line"
          summary={<><Route className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1 text-base">ดู Scenario ทั้งหมด</span><span className="text-xs font-normal text-ink-soft">{trackScenarios('v1').length + trackScenarios('v2').length} Scenario · เส้นทางต่อเนื่อง 2 ชุด</span></>}
        >
          <div className="space-y-6">
            <JourneyCard track="v1" launch={launch} />
            <JourneyCard track="v2" launch={launch} />
            <section>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-lg font-bold text-ink">เลือก Scenario แบบเดี่ยว</h2>
                <p className="text-sm text-ink-soft">Start Demo จะเตรียมข้อมูลจุดเริ่มต้นของเรื่องนั้นให้อัตโนมัติ</p>
              </div>
              <div role="tablist" aria-label="ชุดการสาธิต" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-bg p-1 sm:inline-grid">
                {(['v1', 'v2'] as Track[]).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={cn('rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors sm:min-w-[240px]', tab === t ? 'bg-primary text-white' : 'text-ink-soft hover:bg-white')}
                  >
                    <span className="block">{t === 'v1' ? 'Consumer Protection' : 'Marketplace & Trust Assessment'}</span>
                    <span className={cn('block text-xs font-normal', tab === t ? 'text-white/80' : 'text-ink-soft')}>
                      {TRACK_INFO[t].tagline}
                      {t === 'v2' && ' + 9A · 9B · 14 · 15'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2" role="tabpanel" aria-label={TRACK_INFO[tab].name}>
                {trackScenarios(tab).map((sc) => (
                  <ScenarioCard key={sc.id} sc={sc} onStart={() => startSingle(sc)} />
                ))}
              </div>
            </section>
            <div className="flex flex-col items-start gap-3 rounded-xl bg-bg p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-ink-soft">Start Demo, Reset Scenario และ Restart Scenario คืนข้อมูลเป็นจุดเริ่มต้นของเรื่องนั้นเสมอ</p>
              <Button
                variant="outline"
                icon={RotateCcw}
                onClick={async () => {
                  const r = await confirmDialog({ title: 'Reset Demo Data ทั้งหมด', body: 'ล้างข้อมูลที่เปลี่ยนแปลงทั้งหมด รวมถึงความคืบหน้าของ Full Journey', confirmText: 'รีเซ็ตข้อมูล', tone: 'danger' });
                  if (!r.ok) return;
                  resetAllDemoData();
                  toast.success('รีเซ็ตข้อมูลสาธิตทั้งหมดแล้ว');
                }}
              >
                Reset Demo Data ทั้งหมด
              </Button>
            </div>
          </div>
        </Collapsible>

        {/* ---------------- MVP vs Prototype vs Future + disclaimer ---------------- */}
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
      {dialog}
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

/** ส่วนพับเก็บ (ค่าเริ่มต้นพับ) — ใช้ <details> ของเบราว์เซอร์: กดหรือใช้คีย์บอร์ดเปิด/ปิดได้ */
function Collapsible({ summary, children, testId, open, onToggle, className }: { summary: ReactNode; children: ReactNode; testId: string; open?: boolean; onToggle?: (open: boolean) => void; className?: string }) {
  return (
    <details
      className={cn('group rounded-card border border-line bg-white shadow-card', className)}
      data-testid={testId}
      open={open}
      onToggle={onToggle ? (e) => onToggle((e.currentTarget as HTMLDetailsElement).open) : undefined}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

const JOURNEY_TEXT: Record<Track, { title: string; desc: string; start: string; cont: string; restart: string; confirm: string }> = {
  v1: {
    title: 'สาธิตระบบแบบต่อเนื่อง (Full Journey Demo)',
    desc: 'Scenario 1 → 8 ต่อเนื่อง ใช้บัญชี ร้านค้า และเรื่องร้องเรียนเดียวกันข้ามบทบาท (≈ 45 นาที)',
    start: 'Start Full Journey',
    cont: 'Continue Journey',
    restart: 'Restart Full Journey',
    confirm: 'เริ่ม Full Journey',
  },
  v2: {
    title: 'Full Journey — Marketplace & Trust Assessment',
    desc: 'Scenario 9 → 13 ต่อเนื่อง: เชื่อมข้อมูล (จำลอง) → วิเคราะห์ → ประเมิน → เจ้าหน้าที่ → ผู้บริโภค (≈ 30 นาที)',
    start: 'เริ่ม Journey Marketplace & Trust',
    cont: 'สาธิต Journey Marketplace & Trust ต่อ',
    restart: 'เริ่ม Journey Marketplace & Trust ใหม่',
    confirm: 'เริ่ม Journey Marketplace & Trust จากต้น',
  },
};

/** การ์ด Full Journey ของแต่ละชุด */
function JourneyCard({ track, launch }: { track: Track; launch: (id: string, mode?: 'continue' | 'jump') => void }) {
  const nav = useNavigate();
  const d = useDemoStore();
  const t = JOURNEY_TEXT[track];
  const seq = journeyScenarios(track);
  const active = findScenario(d.activeScenario);
  const inProgress = !!active && (d.status === 'running' || d.status === 'paused');
  const mine = d.journeyMode && (d.journeyTrack ?? 'v1') === track;
  const started = mine || seq.some((s) => d.completed.includes(s.id));
  const branch = trackScenarios(track).filter((s) => s.branch);
  const v2 = track === 'v2';

  const jump = async (sc: ScenarioDef) => {
    const st = scenarioStatus(sc.id);
    if (st === 'completed') return nav(`/demo/complete/${sc.id}`);
    if (st === 'current') return resumeDemo(nav);
    const r = await confirmDialog({
      title: `ข้ามไป Scenario ${scenarioCode(sc)}?`,
      body: 'ข้อมูลที่สร้างไว้ยังอยู่ และ Scenario ที่ค้างอยู่จะหยุดที่ขั้นปัจจุบัน หากข้อมูลจาก Scenario ก่อนหน้ายังไม่ครบ ระบบจะให้เลือกว่าจะกลับไปทำให้ครบหรือใช้ข้อมูลตัวอย่าง',
      confirmText: 'ข้ามไป',
    });
    if (r.ok) launch(sc.id, 'jump');
  };

  return (
    <section className={cn('rounded-card border bg-white p-5', v2 ? 'border-info/30' : 'border-primary/30')} aria-label={t.title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Route className={cn('h-5 w-5 shrink-0', v2 ? 'text-info' : 'text-primary')} />
            {t.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-ink">{TRACK_INFO[track].desc}</p>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{t.desc}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {mine && inProgress ? (
            <Button icon={Play} onClick={() => resumeDemo(nav)}>
              {t.cont}
            </Button>
          ) : (
            <Button
              icon={Play}
              onClick={async () => {
                if (started || inProgress) {
                  const r = await confirmDialog({ title: t.confirm, body: `ระบบจะรีเซ็ตข้อมูลสาธิตเป็นค่าเริ่มต้นครั้งเดียว แล้วเริ่ม Scenario ${seq[0].no}`, confirmText: t.confirm });
                  if (!r.ok) return;
                }
                startJourney(nav, track);
              }}
            >
              {t.start}
            </Button>
          )}
          {started && (
            <Button
              variant="outline"
              icon={RotateCcw}
              onClick={async () => {
                const r = await confirmDialog({ title: t.restart, body: `ล้างข้อมูลทั้งหมดที่สร้างระหว่าง Journey และเริ่ม Scenario ${seq[0].no} ใหม่`, confirmText: 'เริ่มใหม่ทั้งหมด', tone: 'danger' });
                if (r.ok) startJourney(nav, track);
              }}
            >
              {t.restart}
            </Button>
          )}
        </div>
      </div>
      <ol className={cn('mt-4 grid gap-2 sm:grid-cols-2', seq.length > 5 ? 'lg:grid-cols-4' : 'lg:grid-cols-5')}>
        {seq.map((sc) => {
          const st = scenarioStatus(sc.id);
          const chip = STATUS_CHIP[st];
          return (
            <li key={sc.id}>
              <button
                onClick={() => (started ? jump(sc) : undefined)}
                disabled={!started}
                className={cn(
                  'flex h-full w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-default',
                  st === 'current' ? 'border-primary bg-primary-50' : st === 'completed' ? 'border-success/30 bg-success-50/50' : 'border-line',
                  started && 'hover:border-primary/40',
                )}
              >
                <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold', st === 'completed' ? 'bg-success text-white' : st === 'current' ? 'bg-primary text-white' : 'bg-bg text-ink-soft')}>{sc.no}</span>
                <span className="min-w-0">
                  <span className="block font-medium leading-snug text-ink">{sc.title}</span>
                  {started && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft">
                      <chip.icon className="h-3.5 w-3.5" />
                      {chip.label}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {branch.map((b) => (
        <p key={b.id} className="mt-2 flex items-start gap-1.5 text-xs text-ink-soft">
          <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
          <span>
            <b className="text-ink">ทางเลือก {scenarioCode(b)}:</b> {b.title}
          </span>
        </p>
      ))}
      {started && <p className="mt-2 text-xs text-ink-soft">กดที่ Scenario เพื่อดูสรุป (เสร็จแล้ว) สาธิตต่อ (กำลังทำ) หรือข้ามไป (ยังไม่เริ่ม — ระบบขอยืนยันก่อน)</p>}
      {v2 && seq.some((s) => d.completed.includes(s.id)) && (
        <Button variant="outline" icon={Trophy} className="mt-3" onClick={() => nav('/demo/v2/summary')}>
          Executive Impact Summary
        </Button>
      )}
    </section>
  );
}

/** การ์ด Scenario แบบเดี่ยว — ชื่อ คำอธิบาย 1 บรรทัด บทบาท และปุ่มเริ่ม · รายละเอียดพับไว้ */
function ScenarioCard({ sc, onStart }: { sc: ScenarioDef; onStart: () => void }) {
  const st = scenarioStatus(sc.id);
  const v2 = trackOf(sc) === 'v2';
  const code = scenarioCode(sc);
  return (
    <article className={cn('flex flex-col rounded-card border bg-white', st === 'current' ? 'border-primary ring-2 ring-primary/20' : 'border-line')}>
      <div className="flex items-start gap-3 p-4">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold text-white', v2 ? 'bg-info' : sc.no >= 7 ? 'bg-secondary' : 'bg-primary')}>{code}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-ink">{sc.title}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{sc.objective}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
            <Clock className="h-3.5 w-3.5" />
            {sc.duration} · {sc.steps.length} ขั้นตอน
            {!v2 && sc.no >= 7 && <Badge tone="error">AI Simulation</Badge>}
            {v2 && <Badge tone="info">{sc.no >= 14 ? 'Automation First' : sc.branch ? 'เส้นทางทางเลือก' : 'Marketplace (จำลอง)'}</Badge>}
            {st !== 'not_started' && <Badge tone={STATUS_CHIP[st].tone}>{STATUS_CHIP[st].label}</Badge>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sc.audience.map((r) => {
              const a = AUDIENCE[r];
              return (
                <span key={r} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', a.cls)}>
                  <a.icon className="h-3.5 w-3.5" />
                  {a.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <details className="border-t border-line px-4 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink-soft">รายละเอียด · ขั้นตอนการสาธิต ({sc.steps.length})</summary>
        <div className="space-y-3 py-2">
          <p className="text-sm text-ink">{sc.objective}</p>
          {sc.caseNote && <p className="rounded-lg bg-info-50 px-3 py-2 text-xs text-[#1d4ab8]">{sc.caseNote}</p>}
          <ol className="space-y-1.5">
            {sc.steps.map((s, k) => (
              <li key={s.id} className="flex gap-2 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg text-[11px] font-semibold text-ink-soft">{k + 1}</span>
                <span className="min-w-0 text-ink">
                  {s.title} <span className="text-xs text-ink-soft">· {AUDIENCE[s.role].label}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="border-l-4 border-primary/40 pl-3 text-sm italic text-ink">“{sc.keyMessage}”</p>
          <dl className="space-y-1.5 rounded-xl bg-bg p-3 text-sm">
            {BENEFIT_ROWS.map((b) => (
              <div key={b.key} className="flex gap-2">
                <dt className={cn('flex w-[84px] shrink-0 items-center gap-1 font-semibold', b.cls)}>
                  <b.icon className="h-3.5 w-3.5" />
                  {b.label}
                </dt>
                <dd className="min-w-0 text-ink">{sc.benefits[b.key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
      <div className="flex flex-col gap-2 border-t border-line p-3 sm:flex-row">
        <Button icon={Play} className="sm:flex-1" onClick={onStart}>
          Start Demo
        </Button>
        <Button
          variant="outline"
          icon={RotateCcw}
          onClick={async () => {
            const r = await confirmDialog({ title: `Reset Scenario ${code}`, body: 'ข้อมูลสาธิตจะกลับเป็นจุดเริ่มต้นของเรื่องนี้ (แบบเดี่ยว) และหยุดการสาธิตที่ค้างอยู่', confirmText: 'Reset Scenario' });
            if (!r.ok) return;
            resetScenarioData(sc.id);
            toast.success(`Reset Scenario ${code} แล้ว`, 'พร้อมกด Start Demo');
          }}
        >
          Reset Scenario
        </Button>
      </div>
    </article>
  );
}
