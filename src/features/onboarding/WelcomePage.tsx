import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Building2,
  ChevronRight,
  Database,
  FileCheck2,
  FlaskConical,
  Gauge,
  Link2,
  LogIn,
  PenLine,
  Play,
  QrCode,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Store,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useSessionStore, useOperatorStore, useMerchantStore, confirmDialog } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { PrototypeBanner } from '@/components/feedback/Feedback';
import { Logo } from '@/components/common/Trust';
import { Badge, Button, Card } from '@/components/common/ui';
import { DemoPanel } from '@/components/layout/DemoPanel';
import { DEMO_INSET, DemoController, useDemoActive } from '@/components/layout/DemoController';
import { cn } from '@/utils/cn';
import { switchRole } from '@/components/layout/demo';
import { findScenario } from '@/mock/scenarios';
import { MAIN_CTA_LABEL, MAIN_JOURNEY_ID } from '@/demo/main';
import { startScenario } from '@/demo/controller';
import { TRUST_LEVELS } from '@/constants/labels';
import { COMPONENTS, MODEL_V2 } from '@/features/trust-assessment/model';
import { BandCriteriaSection } from './BandCriteriaSection';

/** เส้นทางของผู้ประกอบการ — ยังไม่มีบัญชี → สมัคร (แล้วไปต่อที่เป้าหมาย) · มีบัญชีแต่ยังไม่เข้าสู่ระบบ → เข้าสู่ระบบ (แล้วไปต่อ) */
export const MERCHANT_TARGET = { connect: '/m/register-shop/marketplace', manual: '/m/register-shop' } as const;

/** Section 2 — How SME Trust Works */
const HOW: { title: string; desc: string; icon: LucideIcon }[] = [
  { title: 'เชื่อมร้านค้า / สมัครเอง', desc: 'มีร้านบน Marketplace หรือสมัครด้วยตนเองก็ได้', icon: Store },
  { title: 'นำเข้าหรือกรอกข้อมูล พร้อมยืนยันตัวตน', desc: 'ข้อมูลที่มีอยู่แล้วเติมให้อัตโนมัติ', icon: UserCheck },
  { title: 'ระบบตรวจสอบและประเมินอัตโนมัติ', desc: 'ประเมินจากหลายปัจจัยทันทีเมื่อข้อมูลพร้อม', icon: Gauge },
  { title: 'สร้าง Assessment Badge หรือแจ้งข้อมูลที่ต้องเพิ่มเติม', desc: 'ร้านค้าเห็นสิ่งที่ต้องทำต่อ', icon: BadgeCheck },
  { title: 'ผู้บริโภคตรวจสอบผ่าน QR หรือค้นหาร้านค้า', desc: 'ไม่ต้องสมัครสมาชิก', icon: QrCode },
];

/** Section 4 — ปัจจัยการประเมิน (ตรงกับ Engine v2.1) */
const FACTORS: { key: keyof typeof COMPONENTS | 'coverage' | 'confidence'; th: string; desc: string; icon: LucideIcon }[] = [
  { key: 'C1', th: 'ตัวตนผู้ประกอบการ', desc: 'ยืนยันตัวตน การลงทะเบียน ช่องทางขาย', icon: UserCheck },
  { key: 'C2', th: 'พฤติกรรมการขาย', desc: 'ยกเลิก คืนสินค้า จัดส่งตรงเวลา', icon: TrendingUp },
  { key: 'C3', th: 'คะแนนและรีวิว', desc: 'ดูทั้งคะแนนและจำนวนรีวิวร่วมกัน', icon: Star },
  { key: 'C4', th: 'ราคาและหมวดสินค้า', desc: 'เทียบช่วงราคาของสินค้าประเภทเดียวกัน', icon: Tag },
  { key: 'C5', th: 'การปฏิบัติตามข้อกำหนด', desc: 'การแก้ไขข้อร้องเรียน คำเตือน การอบรม', icon: Scale },
  { key: 'coverage', th: 'ความครบถ้วนของข้อมูล', desc: 'Data Coverage — ข้อมูลมีมากน้อยแค่ไหน', icon: Database },
  { key: 'confidence', th: 'ความเชื่อมั่นในข้อมูล', desc: 'Data Confidence — ข้อมูลใหม่และเชื่อถือได้แค่ไหน', icon: ShieldCheck },
];

/** Section 5 — สถานะของ Badge (ตัวอย่าง) */
const BADGE_STATES: { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' | 'info'; desc: string }[] = [
  { label: 'แสดง Badge (Band A–C)', tone: 'success', desc: 'ข้อมูลผ่านเกณฑ์' },
  { label: 'Insufficient Data', tone: 'neutral', desc: 'ข้อมูลยังไม่พอ — ไม่ใช่ผลลบ' },
  { label: 'Outdated', tone: 'warning', desc: 'ข้อมูลไม่เป็นปัจจุบัน' },
  { label: 'Under Review', tone: 'info', desc: 'รอเจ้าหน้าที่ตรวจเพิ่ม' },
  { label: 'Withheld', tone: 'warning', desc: 'ระหว่างพิจารณาความเสี่ยง' },
  { label: 'Suspended / Revoked', tone: 'error', desc: 'การรับรองถูกระงับ/เพิกถอน' },
];

const BENEFITS: { who: string; icon: LucideIcon; items: string[] }[] = [
  { who: 'ผู้ประกอบการ SME', icon: Store, items: ['ลดการกรอกข้อมูลซ้ำ', 'ประเมินได้ตามข้อมูลที่มี', 'แสดงผลประเมินร้านค้า'] },
  { who: 'ผู้บริโภค', icon: Users, items: ['ตรวจสอบร้านค้า', 'ดูแหล่งข้อมูล', 'ดูสถานะ Badge'] },
  { who: 'เจ้าหน้าที่', icon: Building2, items: ['ลดงานตรวจซ้ำ', 'คัดกรองเฉพาะ Exception', 'มีหลักฐานประกอบการพิจารณา'] },
];

/** กรณีพิเศษที่แสดงบนหน้าแรก (ภายในใช้ Scenario เดิม — ไม่แสดงรหัส) */
const HOME_CASES: { scenario: string; icon: LucideIcon; desc: string }[] = [
  { scenario: 's9b', icon: PenLine, desc: 'ร้านที่ไม่มี Marketplace ลงทะเบียนเอง — ระบบแสดงสถานะ "ข้อมูลยังไม่เพียงพอ" แทน Badge' },
  { scenario: 's15', icon: UserCheck, desc: 'ข้อมูลตัวตนไม่ตรงกัน → เจ้าหน้าที่ตัดสิน → ระบบทำงานต่อ' },
  { scenario: 's6', icon: ShieldCheck, desc: 'เจ้าหน้าที่ระงับการรับรองจากหลักฐาน ร้านค้าชี้แจงและอุทธรณ์ได้' },
];

function SectionHead({ eyebrow, title, desc, id }: { eyebrow: string; title: string; desc?: string; id?: string }) {
  return (
    <div className="mb-6 max-w-3xl" id={id}>
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold leading-snug text-ink sm:text-2xl">{title}</h2>
      {desc && <p className="mt-1.5 text-sm text-ink-soft sm:text-base">{desc}</p>}
    </div>
  );
}

/** ตัวอย่างหน้าจอผลประเมิน (Mock UI) — ไม่ใช่ข้อมูลร้านจริง */
function MockAssessment() {
  return (
    <Card className="p-5 text-ink" aria-label="ตัวอย่างผลประเมิน (Mock UI)" data-testid="home-mock-assessment">
      <p className="text-xs font-semibold text-ink-soft">ตัวอย่างผลประเมิน (Mock UI)</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-3xl font-bold text-white">A</span>
        <div>
          <p className="font-bold text-primary">Trust Assessment Badge</p>
          <p className="text-sm text-ink">ร้านตัวอย่าง (จำลอง)</p>
          <p className="text-xs text-ink-soft">ผลประเมินอัตโนมัติ — ไม่ใช่การรับรอง</p>
        </div>
      </div>
      {[
        ['Data Coverage', 82, 'bg-success'],
        ['Data Confidence', 85, 'bg-primary'],
      ].map(([k, v, c]) => (
        <div key={k as string} className="mt-3">
          <div className="flex justify-between text-xs text-ink-soft">
            <span>{k}</span>
            <span>{v === 85 ? 'สูง' : `${v}%`}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
            <div className={cn('h-full rounded-full', c as string)} style={{ width: `${v}%` }} />
          </div>
        </div>
      ))}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
        <QrCode className="h-3.5 w-3.5" aria-hidden /> แหล่งข้อมูล: Shopee (จำลอง) + ข้อมูลในระบบ · ตรวจสอบได้ผ่าน QR
      </p>
    </Card>
  );
}

export default function WelcomePage() {
  const nav = useNavigate();
  const set = useSessionStore((s) => s.set);
  const demoActive = useDemoActive();
  const opId = useSessionStore((s) => s.operatorId);
  const op = useOperatorStore((s) => s.items.find((o) => o.id === opId));
  const demo = useDemoStore();

  /** ผู้ประกอบการ: ไปยังขั้นตอนลงทะเบียนร้าน (A: Marketplace / B: ลงทะเบียนเอง) ผ่านการสมัครหรือเข้าสู่ระบบเมื่อจำเป็น
   *  บัญชีที่มีร้านลงทะเบียนแล้ว → จัดการช่องทางขายออนไลน์ / ข้อมูลร้านค้า (ไม่เริ่มลงทะเบียนร้านใหม่ซ้ำ) */
  const goMerchant = (wanted: string) => {
    const hasShop = !!op && useMerchantStore.getState().items.some((m) => m.operatorId === op.id && m.registrationStatus !== 'draft');
    const target = hasShop ? (wanted === MERCHANT_TARGET.connect ? '/m/marketplace' : '/m/shop') : wanted;
    if (!op) {
      switchRole('merchant');
      nav('/register', { state: { next: target } });
      return;
    }
    const s = useSessionStore.getState();
    const signedIn = s.role === 'merchant' && s.merchantLoggedIn;
    switchRole('merchant');
    if (signedIn) return nav(target);
    set({ merchantLoggedIn: false });
    nav('/login', { state: { from: target } });
  };
  const login = () => {
    if (!opId) set({ operatorId: 'OP-001' });
    switchRole('merchant');
    set({ merchantLoggedIn: false });
    nav('/login');
  };
  const consumer = (to: string) => {
    switchRole('consumer');
    nav(to);
  };
  /** เริ่ม Demo — ถ้ากำลังสาธิตอยู่ให้ยืนยันก่อนรีเซ็ต */
  const startDemo = async (id: string) => {
    const sc = findScenario(id);
    if (!sc) return;
    if (demo.status === 'running' || demo.status === 'paused') {
      const r = await confirmDialog({ title: `เริ่ม "${sc.title}"?`, body: 'ระบบจะรีเซ็ตข้อมูลสาธิตเป็นค่าเริ่มต้น แล้วเริ่มการสาธิตที่เลือก', confirmText: 'เริ่มตั้งแต่ต้น' });
      if (!r.ok) return;
    }
    startScenario(id, nav);
  };

  return (
    <div className={cn('min-h-screen bg-bg', demoActive && `${DEMO_INSET} pb-24 lg:pb-0`)}>
      <PrototypeBanner />
      <header className="bg-primary-dark text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Logo light />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* ทุกขนาดจอ: เข้าสู่ระบบมองเห็นเสมอ · จอเล็กย่อปุ่ม Demo Mode เหลือไอคอน (ชื่อปุ่มยังอ่านได้ด้วย aria-label) เพื่อไม่ให้ Header ล้น */}
            <button onClick={login} data-testid="header-login" className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/30 px-2.5 text-sm font-medium hover:bg-white/10 sm:border-transparent sm:px-3">
              <LogIn className="h-4 w-4" />
              เข้าสู่ระบบ
            </button>
            <button onClick={() => set({ demoPanelOpen: true })} aria-label="Demo Mode" title="Demo Mode" className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl bg-white/10 px-2.5 text-sm font-medium hover:bg-white/20 sm:px-3">
              <FlaskConical className="h-4 w-4" />
              <span className="hidden sm:inline">Demo Mode</span>
            </button>
          </div>
        </div>
      </header>
      <main>
        {/* ---------------------------------------------------------------- 1. Hero */}
        <div className="bg-gradient-to-b from-primary-dark to-primary text-white">
          <section aria-label="SME Trust" className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-8 sm:px-6 md:pt-12 lg:grid-cols-[1.35fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <FlaskConical className="h-3.5 w-3.5" />
                ต้นแบบ (Prototype) · ข้อมูลจำลองทั้งหมด
              </span>
              <h1 className="mt-4 text-[1.65rem] font-bold leading-snug sm:text-4xl sm:leading-tight">เชื่อมข้อมูลร้านค้า ประเมินความน่าเชื่อถือ สร้างความมั่นใจในการซื้อขายออนไลน์</h1>
              <p className="mt-4 text-white/85 sm:text-lg">
                SME Trust เป็นแพลตฟอร์มกลางที่ช่วยผู้ประกอบการเชื่อมข้อมูลจากช่องทางขายออนไลน์ หรือสมัครด้วยตนเอง เพื่อประเมินความน่าเชื่อถือจากหลายปัจจัย และให้ผู้บริโภคตรวจสอบข้อมูลร้านค้าได้อย่างโปร่งใส
              </p>
              <p className="mt-3 inline-flex rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white/95" data-testid="not-marketplace">
                ไม่ใช่ Marketplace ไม่ขายสินค้า และไม่รับชำระเงิน
              </p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2" aria-label="เริ่มต้นใช้งาน">
                <Button size="lg" variant="inverse" icon={Play} className="sm:col-span-2" onClick={() => void startDemo(MAIN_JOURNEY_ID)} data-testid="home-main-cta">
                  {MAIN_CTA_LABEL}
                </Button>
                <Button size="lg" variant="inverseOutline" icon={Link2} onClick={() => goMerchant(MERCHANT_TARGET.connect)}>
                  เชื่อมร้านค้าออนไลน์
                </Button>
                <Button size="lg" variant="inverseOutline" icon={PenLine} onClick={() => goMerchant(MERCHANT_TARGET.manual)}>
                  ลงทะเบียนด้วยตนเอง
                </Button>
                <Button size="lg" variant="inverseOutline" icon={Search} onClick={() => consumer('/check')}>
                  ตรวจสอบร้านค้า
                </Button>
              </div>
              {op && <p className="mt-3 text-sm text-white/70">บัญชีล่าสุดบนอุปกรณ์นี้: {op.name}</p>}
            </div>
            <MockAssessment />
          </section>
        </div>

        {/* ---------------------------------------------------------------- 2. How it works */}
        <section aria-labelledby="home-how" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead id="home-how" eyebrow="How SME Trust Works" title="ทำงานอย่างไร — 5 ขั้นตอน" />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="ขั้นตอนการทำงานของ SME Trust">
            {HOW.map((s, i) => (
              <li key={s.title} className="relative flex gap-3 rounded-card border border-line bg-white p-4 lg:flex-col" data-step={i + 1}>
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white">
                  <s.icon className="h-5 w-5" aria-hidden />
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-secondary text-[11px] font-bold">{i + 1}</span>
                </span>
                <div>
                  <p className="font-semibold leading-snug text-ink">{s.title}</p>
                  <p className="mt-0.5 text-sm text-ink-soft">{s.desc}</p>
                </div>
                {i < HOW.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary/50 lg:block" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary">
            <Bot className="h-4 w-4" aria-hidden />
            เจ้าหน้าที่ตรวจสอบเฉพาะกรณีจำเป็น
          </p>
        </section>

        {/* ---------------------------------------------------------------- 3. Two registration paths */}
        <div className="border-y border-line bg-white">
          <section aria-labelledby="home-paths" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHead id="home-paths" eyebrow="สมัครได้ 2 ช่องทาง" title="มีร้านบน Marketplace หรือไม่มีก็สมัครได้" desc="ทั้งสองช่องทางได้รับการประเมินภายใต้มาตรฐานเดียวกัน — ร้านที่ไม่มี Marketplace ไม่ถูกหักคะแนน" />
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { key: 'A', title: 'A. มีร้านบน Marketplace', icon: Link2, steps: ['เชื่อมบัญชี (จำลอง)', 'นำเข้าข้อมูล', 'Auto-Fill', 'ตรวจสอบและแก้ไข', 'ยืนยัน'], cta: 'เชื่อมบัญชี Marketplace', go: () => goMerchant(MERCHANT_TARGET.connect), note: 'Shopee (จำลอง) · Lazada (จำลอง) · รองรับแพลตฟอร์มอื่นในอนาคต' },
                { key: 'B', title: 'B. ไม่มี Marketplace', icon: PenLine, steps: ['กรอกข้อมูลร้านค้า', 'เลือกประเภทผู้ประกอบการ', 'เพิ่มหลักฐาน', 'ยืนยัน', 'ประเมิน'], cta: 'สมัครด้วยตนเอง', go: () => goMerchant(MERCHANT_TARGET.manual), note: 'บุคคลธรรมดาหรือนิติบุคคล · เพิ่ม Marketplace ภายหลังได้' },
              ].map((p) => (
                <Card key={p.key} className="flex flex-col p-5" data-path={p.key}>
                  <p className="flex items-center gap-2 text-lg font-bold text-ink">
                    <p.icon className="h-5 w-5 text-primary" aria-hidden />
                    {p.title}
                  </p>
                  <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
                    {p.steps.map((s, i) => (
                      <li key={s} className="flex items-center gap-1.5">
                        <span className="rounded-lg bg-bg px-2.5 py-1 text-ink">
                          <b className="text-primary">{i + 1}</b> {s}
                        </span>
                        {i < p.steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-ink-soft" aria-hidden />}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 flex-1 text-xs text-ink-soft">{p.note}</p>
                  <Button variant="outline" className="mt-4 self-start" icon={ArrowRight} onClick={p.go}>
                    {p.cta}
                  </Button>
                </Card>
              ))}
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------------- 4. Trust Assessment */}
        <section aria-labelledby="home-assessment" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead id="home-assessment" eyebrow="Trust Assessment" title="ประเมินจากหลายปัจจัย ไม่ใช่คะแนนดาวอย่างเดียว" />
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="grid gap-3 sm:grid-cols-2">
              {FACTORS.map((f) => (
                <div key={f.key} className="flex gap-3 rounded-card border border-line bg-white p-4" data-factor={f.key in COMPONENTS ? COMPONENTS[f.key as keyof typeof COMPONENTS].en : f.key}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary">
                    <f.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{f.th}</p>
                    <p className="text-xs text-ink-soft">{f.desc}</p>
                    {f.key in COMPONENTS && <p className="text-[11px] text-ink-soft">{COMPONENTS[f.key as keyof typeof COMPONENTS].en} · น้ำหนัก {MODEL_V2.weights[f.key as keyof typeof COMPONENTS]}%</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <Card className="p-5">
                <p className="text-sm font-semibold text-ink">ผลประเมินเป็น Band</p>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="ตัวอย่าง Band">
                  {(['A', 'B', 'C', 'D'] as const).map((b) => (
                    <span key={b} className={cn('grid h-10 w-10 place-items-center rounded-xl font-bold text-white', b === 'A' || b === 'B' ? 'bg-success' : b === 'C' ? 'bg-warning' : 'bg-error')}>
                      {b}
                    </span>
                  ))}
                  <span className="grid h-10 place-items-center rounded-xl bg-ink-soft px-3 text-xs font-semibold text-white">ข้อมูลไม่พอ</span>
                </div>
                <p className="mt-3 text-xs text-ink-soft">Coverage (ความครบถ้วน) และ Confidence (ความเชื่อมั่น) แสดงแยกกันเสมอ · ข้อมูลที่ขาดไม่ถูกนับเป็นศูนย์</p>
              </Card>
              <ul className="space-y-1 rounded-card border border-line bg-white p-4 text-xs text-ink-soft">
                <li>• ผู้บริโภคไม่เห็นคะแนนภายใน เห็นเฉพาะ Band และข้อมูลประกอบ</li>
                <li>• ระบบไม่สามารถตรวจจับการทุจริตได้ทั้งหมด — สัญญาณความเสี่ยงคือข้อสังเกต ไม่ใช่ข้อสรุปว่ากระทำผิด</li>
                <li>• โมเดล {MODEL_V2.version} (กฎจำลอง ยังไม่ได้ปรับเทียบกับข้อมูลจริง)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- 4b. เกณฑ์การจัดระดับ Band + ข้อมูลขั้นต่ำ */}
        <BandCriteriaSection />

        {/* ---------------------------------------------------------------- 5. Assessment Badge */}
        <div className="border-y border-line bg-white">
          <section aria-labelledby="home-badge" className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <div>
              <SectionHead id="home-badge" eyebrow="Assessment Badge" title="ระบบสร้างผลประเมินและ Assessment Badge อัตโนมัติ เมื่อข้อมูลผ่านเกณฑ์" />
              <ul className="space-y-2 text-sm text-ink">
                <li className="flex gap-2">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  หากข้อมูลขาดหรือขัดแย้ง ระบบจะแจ้งให้เพิ่มเติม หรือส่งตรวจเฉพาะกรณีที่จำเป็น
                </li>
                <li className="flex gap-2">
                  <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  การรับรองระดับที่ต้องใช้อำนาจอนุมัติยังแยกจากผลประเมินอัตโนมัติ
                </li>
              </ul>
              <div className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="สถานะของ Badge">
                {BADGE_STATES.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="text-xs text-ink-soft">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3" aria-label="ความแตกต่างของ Assessment Badge, Certification Level และสถานะการรับรอง">
              <Card className="p-4" data-concept="assessment-badge">
                <p className="font-semibold text-ink">Assessment Badge</p>
                <p className="text-xs font-medium text-primary">ผลประเมินอัตโนมัติ — อัปเดตเมื่อข้อมูลเปลี่ยน</p>
              </Card>
              <Card className="p-4" data-concept="level">
                <p className="font-semibold text-ink">Certification Level</p>
                <p className="text-xs font-medium text-primary">Level 1 จากการยืนยันตัวตน · Level 2–4 เจ้าหน้าที่อนุมัติ</p>
                <p className="mt-1 text-xs text-ink-soft">{([1, 2, 3, 4] as const).map((l) => `Level ${l} ${TRUST_LEVELS[l].name}`).join(' · ')}</p>
              </Card>
              <Card className="p-4" data-concept="status">
                <p className="font-semibold text-ink">สถานะการรับรอง</p>
                <p className="text-xs font-medium text-primary">Suspended (ระงับ) / Revoked (เพิกถอน) เป็นมาตรการของเจ้าหน้าที่ — Badge ไม่แสดงระหว่างนี้</p>
              </Card>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------------- 6. Benefits */}
        <section aria-labelledby="home-benefits" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <SectionHead id="home-benefits" eyebrow="ประโยชน์" title="ประโยชน์สำหรับทุกฝ่าย" />
          <div className="grid gap-4 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <Card key={b.who} className="p-5" data-benefit={b.who}>
                <p className="flex items-center gap-2 font-bold text-ink">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-50 text-primary">
                    <b.icon className="h-5 w-5" aria-hidden />
                  </span>
                  {b.who}
                </p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink">
                  {b.items.map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- 7. Interactive Demo */}
        <div className="border-y border-line bg-white">
          <section aria-labelledby="home-demo" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <SectionHead id="home-demo" eyebrow="Interactive Demo" title="ทดลองใช้งานด้วยข้อมูลจำลอง" />
            <Card className="mb-4 border-2 border-primary/50 p-5" aria-label="Demo หลัก">
              <p className="text-lg font-bold text-ink">{MAIN_CTA_LABEL}</p>
              <p className="mt-1 text-sm text-ink-soft">เชื่อมข้อมูลร้านค้า → ลงทะเบียน → ตรวจสอบอัตโนมัติ → ประเมินความน่าเชื่อถือ → แสดงผล Badge → ผู้บริโภคตรวจสอบ · ใช้ร้านค้าเดียวกันทุกขั้น ไม่มีขั้นตอนของเจ้าหน้าที่ในกรณีปกติ</p>
              <Button variant="outline" icon={Play} className="mt-4" onClick={() => void startDemo(MAIN_JOURNEY_ID)}>
                เริ่มทดลอง
              </Button>
            </Card>
            <p className="mb-2 text-sm font-semibold text-ink">กรณีพิเศษ (เฉพาะกรณีจำเป็น)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {HOME_CASES.map((c) => {
                const sc = findScenario(c.scenario)!;
                return (
                  <Card key={c.scenario} className="flex flex-col p-4" data-journey={sc.title}>
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <c.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      {sc.title}
                    </p>
                    <p className="mt-1 flex-1 text-sm text-ink-soft">{c.desc}</p>
                    <Button size="sm" variant="outline" className="mt-3 self-start" icon={Play} onClick={() => void startDemo(c.scenario)}>
                      ทดลองกรณีนี้
                    </Button>
                  </Card>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              ดูผลลัพธ์โดยตรงและฟังก์ชันอื่นของระบบได้ที่{' '}
              <Link to="/demo" className="font-medium text-primary hover:underline">
                หน้า Demo
              </Link>
            </p>
          </section>
        </div>

        {/* ---------------------------------------------------------------- 8. About / Prototype Notice */}
        <section aria-labelledby="home-about" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <Card className="p-5">
            <p id="home-about" className="font-semibold text-ink">
              เกี่ยวกับต้นแบบนี้
            </p>
            <p className="mt-2 rounded-xl bg-warning-50 p-3 text-sm font-medium text-ink" data-testid="prototype-disclaimer">
              ระบบนี้เป็นต้นแบบเพื่อสาธิตแนวคิด ใช้ข้อมูลจำลอง และยังไม่เชื่อมต่อกับ Shopee, Lazada, DBD หรือ สคบ. จริง
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              <li>ผลประเมินและ Badge ไม่ใช่ใบรับรองทางการ และไม่ได้รับการรับรองจาก สคบ.</li>
              <li>Frontend-only ไม่มี Backend ไม่เรียก API และไม่ส่งข้อมูลออกนอกเบราว์เซอร์ — ข้อมูลสมมติเก็บใน localStorage ของเบราว์เซอร์นี้เท่านั้น</li>
              <li>ได้รับแรงบันดาลใจจากแนวคิดความร่วมมือระหว่างสภา SME และ สคบ. แต่ไม่ใช่ระบบที่หน่วยงานรับรองหรือใช้งานจริง</li>
              <li>ใช้ปุ่ม "Demo Mode" เพื่อสลับบทบาท และรีเซ็ตข้อมูลได้ตลอดเวลา</li>
            </ul>
          </Card>
        </section>
      </main>
      <DemoPanel />
      <DemoController />
    </div>
  );
}
