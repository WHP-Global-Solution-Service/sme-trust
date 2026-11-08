import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  FlaskConical,
  Gauge,
  Link2,
  LogIn,
  MonitorPlay,
  PenLine,
  Play,
  QrCode,
  Search,
  ShieldCheck,
  Store,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import { useSessionStore, useOperatorStore, confirmDialog } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { PrototypeBanner } from '@/components/feedback/Feedback';
import { Logo } from '@/components/common/Trust';
import { Button, Card } from '@/components/common/ui';
import { DemoPanel } from '@/components/layout/DemoPanel';
import { DEMO_INSET, DemoController, useDemoActive } from '@/components/layout/DemoController';
import { cn } from '@/utils/cn';
import { switchRole } from '@/components/layout/demo';
import { allScenarios, journeyScenarios, scenarioCode, trackScenarios } from '@/mock/scenarios';
import { startJourney, startScenario } from '@/demo/controller';
import { TRUST_LEVELS } from '@/constants/labels';
import { COMPONENTS, MODEL_V2 } from '@/features/trust-assessment/model';

/** เส้นทางของผู้ประกอบการ — ยังไม่มีบัญชี → สมัคร (แล้วไปต่อที่เป้าหมาย) · มีบัญชีแต่ยังไม่เข้าสู่ระบบ → เข้าสู่ระบบ (แล้วไปต่อ) */
export const MERCHANT_TARGET = { connect: '/m/register-shop/marketplace', manual: '/m/register-shop' } as const;

const FLOW: { title: string; desc: string }[] = [
  { title: 'Connect', desc: 'เลือก Shopee หรือ Lazada (จำลอง)' },
  { title: 'Mock Authorization', desc: 'อนุญาตเข้าถึงข้อมูลร้าน ไม่มีการขอรหัสผ่าน' },
  { title: 'Auto Import', desc: 'ดึงคะแนน รีวิว ราคา ยอดขาย (จำลอง)' },
  { title: 'Auto-Fill', desc: 'เติมชื่อร้าน คำอธิบาย และหมวดหมู่ให้' },
  { title: 'Review/Edit', desc: 'ตรวจและแก้ไขก่อนส่ง เห็นที่มาของทุกช่อง' },
  { title: 'Confirm', desc: 'ผู้ประกอบการกดยืนยันเอง ระบบไม่ส่งแทน' },
];

const CHANNELS: { name: string; tag: string; desc: string; icon: LucideIcon }[] = [
  { name: 'Shopee (จำลอง)', tag: 'เชื่อมต่อ', desc: 'นำเข้าข้อมูลร้านจาก Marketplace จำลอง', icon: Link2 },
  { name: 'Lazada (จำลอง)', tag: 'เชื่อมต่อ', desc: 'นำเข้าข้อมูลร้านจาก Marketplace จำลอง', icon: Link2 },
  { name: 'ช่องทางอื่น', tag: 'ลงทะเบียนเอง', desc: 'เว็บไซต์ โซเชียลมีเดีย หรือหน้าร้าน — กรอกข้อมูลและแนบเอกสารเอง', icon: PenLine },
];

const QUALITY: { en: string; th: string; desc: string }[] = [
  { en: 'Data Coverage', th: 'ความครบถ้วนของข้อมูล', desc: 'จำนวนแพลตฟอร์ม ระยะเวลา สินค้า คำสั่งซื้อ และรีวิว' },
  { en: 'Data Confidence', th: 'ความเชื่อมั่นของข้อมูล', desc: 'ความสดใหม่ จำนวนแหล่ง และขนาดตัวอย่าง' },
];

const BADGE_STEPS: { title: string; desc: string; icon: LucideIcon }[] = [
  { title: 'ระบบประเมินอัตโนมัติ', desc: 'ประเมินทันทีเมื่อร้านนำเข้าหรือซิงก์ข้อมูล', icon: Gauge },
  { title: 'ออก Assessment Badge อัตโนมัติ', desc: 'เมื่อข้อมูลครบและไม่มีประเด็นที่ต้องตรวจ', icon: Bot },
  { title: 'เจ้าหน้าที่ตรวจเฉพาะกรณียกเว้น', desc: 'ข้อมูลตัวตนขัดแย้ง สัญญาณที่ต้องพิจารณา และการอนุมัติใบรับรอง', icon: UserCheck },
  { title: 'ผู้บริโภคตรวจสอบ', desc: 'สแกน QR หรือค้นหาร้านค้า', icon: QrCode },
];

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mb-5 max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{title}</h2>
      {desc && <p className="mt-1.5 text-sm text-ink-soft sm:text-base">{desc}</p>}
    </div>
  );
}

export default function WelcomePage() {
  const nav = useNavigate();
  const set = useSessionStore((s) => s.set);
  const demoActive = useDemoActive();
  const opId = useSessionStore((s) => s.operatorId);
  const op = useOperatorStore((s) => s.items.find((o) => o.id === opId));
  const demo = useDemoStore();
  const v1Count = trackScenarios('v1').length;
  const v2Main = journeyScenarios('v2');
  const branches = trackScenarios('v2').filter((s) => s.branch);

  /** ผู้ประกอบการ: ไปยังขั้นตอนลงทะเบียนร้าน (A: Marketplace / B: ลงทะเบียนเอง) ผ่านการสมัครหรือเข้าสู่ระบบเมื่อจำเป็น */
  const goMerchant = (target: string) => {
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
  const startAuto = async (id: 's14' | 's15') => {
    const busy = demo.status === 'running' || demo.status === 'paused';
    if (busy) {
      const r = await confirmDialog({ title: `เริ่ม Scenario ${id.slice(1)}`, body: 'ระบบจะรีเซ็ตข้อมูลสาธิตเป็นค่าเริ่มต้น แล้วเริ่ม Scenario ที่เลือก', confirmText: 'เริ่ม' });
      if (!r.ok) return;
    }
    startScenario(id, nav);
  };
  const startV2 = async () => {
    const busy = demo.status === 'running' || demo.status === 'paused' || demo.completed.length > 0;
    if (busy) {
      const r = await confirmDialog({ title: 'เริ่ม Full Journey: Marketplace & Trust', body: 'ระบบจะรีเซ็ตข้อมูลสาธิตเป็นค่าเริ่มต้นครั้งเดียว แล้วเริ่ม Scenario 9', confirmText: 'เริ่ม Journey Marketplace & Trust' });
      if (!r.ok) return;
    }
    startJourney(nav, 'v2');
  };

  return (
    <div className={cn('min-h-screen bg-bg', demoActive && `${DEMO_INSET} pb-24 lg:pb-0`)}>
      <PrototypeBanner />
      <header className="bg-primary-dark text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo light />
          <button onClick={() => set({ demoPanelOpen: true })} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-medium hover:bg-white/20">
            <FlaskConical className="h-4 w-4" />
            Demo Mode
          </button>
        </div>
      </header>
      <main>
        {/* ---------------------------------------------------------------- Hero */}
        <div className="bg-gradient-to-b from-primary-dark to-primary text-white">
          <section aria-label="SME Trust" className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-8 sm:px-6 md:pt-12 lg:grid-cols-[1.35fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <FlaskConical className="h-3.5 w-3.5" />
                ต้นแบบ (Prototype) · ข้อมูลจำลองทั้งหมด
              </span>
              <h1 className="mt-4 text-[1.75rem] font-bold leading-snug sm:text-4xl sm:leading-tight">เชื่อมข้อมูลร้านค้าออนไลน์ ประเมินความน่าเชื่อถืออย่างโปร่งใส</h1>
              <p className="mt-4 text-white/85 sm:text-lg">
                SME Trust ช่วยรวบรวมข้อมูลจากช่องทางขายออนไลน์ นำคะแนน รีวิว ราคา และพฤติกรรมการขายมาวิเคราะห์ตามความเสี่ยง เพื่อสนับสนุนการตรวจสอบร้านค้าและการพิจารณา Trust Badge
              </p>
              <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm text-white/90">ผู้ประกอบการสามารถเชื่อมร้านค้าจาก Marketplace หรือสมัครด้วยตนเอง โดยไม่ต้องเปลี่ยนช่องทางขายเดิม</p>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-2" aria-label="เริ่มต้นใช้งาน">
                <Button size="lg" variant="inverse" icon={Link2} onClick={() => goMerchant(MERCHANT_TARGET.connect)}>
                  เชื่อมร้านค้าออนไลน์
                </Button>
                <Button size="lg" variant="inverseOutline" icon={PenLine} onClick={() => goMerchant(MERCHANT_TARGET.manual)}>
                  ลงทะเบียนด้วยตนเอง
                </Button>
                <Button size="lg" variant="inverseOutline" icon={LogIn} onClick={login}>
                  เข้าสู่ระบบ
                </Button>
                <Button size="lg" variant="inverseOutline" icon={Search} onClick={() => consumer('/check')}>
                  ตรวจสอบร้านค้า
                </Button>
              </div>
              {op && <p className="mt-3 text-sm text-white/70">บัญชีล่าสุดบนอุปกรณ์นี้: {op.name}</p>}
            </div>
            <Card className="p-5 text-ink" aria-label="SME Trust คืออะไร">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
                SME Trust คืออะไร
              </p>
              <p className="mt-2 text-sm text-ink-soft">แพลตฟอร์มกลางที่รวบรวมและประเมินข้อมูลความน่าเชื่อถือของร้านค้าจากช่องทางขายออนไลน์ต่าง ๆ เพื่อสนับสนุนผู้ประกอบการ ผู้บริโภค และเจ้าหน้าที่</p>
              <ul className="mt-4 grid gap-2 text-sm" aria-label="สิ่งที่ SME Trust ไม่ใช่">
                {['ไม่ใช่ Marketplace', 'ไม่ขายสินค้า', 'ไม่รับชำระเงิน', 'ไม่แข่งขันกับ Shopee, Lazada หรือแพลตฟอร์ม E-Commerce อื่น'].map((t) => (
                  <li key={t} className="flex items-start gap-2 rounded-lg bg-bg px-3 py-2">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-bold leading-none text-white" aria-hidden>
                      ✕
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-soft">เป็นต้นแบบที่ใช้ข้อมูลจำลองเท่านั้น ไม่ได้เชื่อมต่อ Shopee, Lazada หรือ สคบ. จริง</p>
            </Card>
          </section>
        </div>

        {/* ---------------------------------------------------------------- Marketplace connection */}
        <section aria-labelledby="home-connect" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div id="home-connect">
            <SectionHead eyebrow="Marketplace Connection" title="เชื่อมร้านค้าเดิม ไม่ต้องย้ายช่องทางขาย" desc="นำข้อมูลร้านจาก Marketplace มาใช้ลงทะเบียนและประกอบการประเมิน — หรือลงทะเบียนเองสำหรับช่องทางอื่น" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {CHANNELS.map((c) => (
              <Card key={c.name} className="flex items-start gap-3 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary">
                  <c.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs font-medium text-primary">{c.tag}</p>
                  <p className="mt-1 text-sm text-ink-soft">{c.desc}</p>
                </div>
              </Card>
            ))}
          </div>
          <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="ขั้นตอนการเชื่อมร้านค้า">
            {FLOW.map((f, i) => (
              <li key={f.title} className="relative rounded-card border border-line bg-white p-3">
                <span className="text-xs font-semibold text-primary">ขั้น {i + 1}</span>
                <p className="mt-0.5 font-semibold text-ink">{f.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{f.desc}</p>
                {i < FLOW.length - 1 && <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-primary/60 lg:block" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-ink-soft">
            <b className="text-ink">ไม่ได้เชื่อมต่อ API จริง</b> — หน้าอนุญาตเป็นการจำลอง ไม่ใช่หน้า Login ของแพลตฟอร์ม ไม่ขอรหัสผ่าน และไม่เก็บ Token
          </p>
        </section>

        {/* ---------------------------------------------------------------- Trust assessment */}
        <div className="border-y border-line bg-white">
          <section aria-labelledby="home-assessment" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <div id="home-assessment">
              <SectionHead eyebrow="Trust Assessment" title="ประเมินจากหลายปัจจัย ไม่ใช่คะแนนดาวอย่างเดียว" desc="คำนึงถึงหมวดสินค้า ระดับราคาเทียบราคากลางอ้างอิง ปริมาณการซื้อ รีวิวที่ถ่วงน้ำหนักตามความใหม่ ความสดใหม่ และความครบถ้วนของข้อมูล" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(Object.keys(COMPONENTS) as (keyof typeof COMPONENTS)[]).map((k) => (
                <div key={k} className="rounded-card border border-line p-4" data-factor={COMPONENTS[k].en}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-ink">{COMPONENTS[k].en}</p>
                    <span className="text-xs text-ink-soft">น้ำหนัก {MODEL_V2.weights[k]}%</span>
                  </div>
                  <p className="text-sm text-primary">{COMPONENTS[k].label}</p>
                  <p className="mt-1 text-xs text-ink-soft">{COMPONENTS[k].desc}</p>
                </div>
              ))}
              {QUALITY.map((q) => (
                <div key={q.en} className="rounded-card border border-primary/30 bg-primary-50 p-4" data-factor={q.en}>
                  <p className="font-semibold text-ink">{q.en}</p>
                  <p className="text-sm text-primary">{q.th}</p>
                  <p className="mt-1 text-xs text-ink-soft">{q.desc}</p>
                </div>
              ))}
            </div>
            <ul className="mt-4 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
              <li>• ข้อมูลน้อยกว่าเกณฑ์ขั้นต่ำ ({MODEL_V2.minimums.orders} คำสั่งซื้อ / {MODEL_V2.minimums.reviews} รีวิว / {MODEL_V2.minimums.months} เดือน) แสดงเป็น "ข้อมูลยังไม่เพียงพอ" ไม่ใช่ร้านมีปัญหา</li>
              <li>• มิติที่ไม่มีข้อมูลไม่ถูกนับเป็นศูนย์ และ Band A ต้องมีความเชื่อมั่นของข้อมูลสูง</li>
              <li>• สัญญาณความเสี่ยง เช่น ราคาต่ำผิดปกติหรือรีวิวกระจุกตัว เป็นข้อสังเกตให้ตรวจสอบ ไม่ใช่ข้อสรุปว่ากระทำผิด</li>
              <li>• ระบบไม่สามารถตรวจจับการทุจริตได้ทั้งหมด — ผลประเมินเป็นข้อมูลประกอบการพิจารณาของเจ้าหน้าที่ (Model {MODEL_V2.version})</li>
            </ul>
          </section>
        </div>

        {/* ---------------------------------------------------------------- Trust badge */}
        <section aria-labelledby="home-badge" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div id="home-badge">
            <SectionHead eyebrow="Trust Badge" title="ระบบประเมินและแสดง Trust Assessment Badge อัตโนมัติจากข้อมูลร้านค้า โดยส่งเฉพาะกรณีที่ต้องตรวจสอบเพิ่มเติมให้เจ้าหน้าที่พิจารณา" />
            <p className="-mt-2 mb-4 text-sm text-ink-soft">ใบรับรองที่ต้องได้รับอนุมัติอย่างเป็นทางการ (Certification Level 2–4) ยังมีกระบวนการพิจารณาของเจ้าหน้าที่แยกต่างหาก — Assessment Badge เป็นผลประเมิน ไม่ใช่การรับรอง</p>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary" data-testid="automation-tagline">
              <Bot className="h-4 w-4" aria-hidden />
              ลดขั้นตอนผู้ประกอบการ ลดงานตรวจสอบซ้ำ และให้เจ้าหน้าที่มุ่งเน้นกรณีที่จำเป็น
            </p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="ขั้นตอนการรับรอง">
            {BADGE_STEPS.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3 rounded-card border border-line bg-white p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    <s.icon className="h-4 w-4 text-primary" aria-hidden />
                    {s.title}
                  </p>
                  <p className="text-sm text-ink-soft">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="ความแตกต่างของ Trust Band ระดับใบรับรอง และสถานะ">
            <Card className="p-4" data-concept="assessment-badge">
              <p className="font-semibold text-ink">Assessment Badge</p>
              <p className="text-xs font-medium text-primary">ผลประเมินอัตโนมัติ</p>
              <p className="mt-1 text-sm text-ink-soft">ออกและอัปเดตเองเมื่อข้อมูลเปลี่ยน · ไม่แสดงระหว่างตรวจสอบเพิ่มเติม หรือเมื่อข้อมูลไม่พอ</p>
            </Card>
            <Card className="p-4" data-concept="band">
              <p className="font-semibold text-ink">Trust Band</p>
              <p className="text-xs font-medium text-primary">ผลประเมินจากข้อมูล</p>
              <p className="mt-1 text-sm text-ink-soft">Band A · B · C · D หรือ "ข้อมูลยังไม่เพียงพอ" — คำนวณใหม่ได้เมื่อข้อมูลเปลี่ยน</p>
            </Card>
            <Card className="p-4" data-concept="level">
              <p className="font-semibold text-ink">Certification Level</p>
              <p className="text-xs font-medium text-primary">ระดับใบรับรอง (Level 1 จาก e-KYC · Level 2–4 เจ้าหน้าที่อนุมัติ)</p>
              <p className="mt-1 text-sm text-ink-soft">
                {([1, 2, 3, 4] as const).map((l) => `Level ${l} ${TRUST_LEVELS[l].name}`).join(' · ')}
              </p>
            </Card>
            <Card className="p-4" data-concept="status">
              <p className="font-semibold text-ink">สถานะใบรับรอง</p>
              <p className="text-xs font-medium text-primary">ใช้งานได้หรือไม่ ณ ตอนนี้</p>
              <p className="mt-1 text-sm text-ink-soft">ปกติ · หมดอายุ · Suspended (ระงับชั่วคราว) · Revoked (เพิกถอน) — Band ที่ดีไม่ได้แทนใบรับรองที่ถูกระงับ</p>
            </Card>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Consumer */}
        <div className="border-y border-line bg-white">
          <section aria-labelledby="home-consumer" className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <div id="home-consumer">
                <SectionHead eyebrow="สำหรับผู้บริโภค" title="ตรวจสอบร้านค้าก่อนซื้อ ไม่ต้องสมัครสมาชิก" />
              </div>
              <ul className="grid gap-2 text-sm text-ink sm:grid-cols-2">
                {['ตรวจสอบข้อมูลร้านค้า', 'ดูช่องทางขายที่เชื่อมโยง', 'ดู Trust Band และข้อมูลประกอบ', 'ตรวจสอบสถานะใบรับรอง', 'ดูความครอบคลุมและความเชื่อมั่นของข้อมูล'].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-soft">ผู้บริโภคเห็น Band และข้อมูลประกอบ — ไม่เห็นคะแนนภายในที่ใช้ในการพิจารณาของเจ้าหน้าที่</p>
            </div>
            <Card className="p-5">
              <div className="grid gap-2 min-[400px]:grid-cols-2">
                <Button variant="secondary" icon={Search} onClick={() => consumer('/check')}>
                  ค้นหาร้านค้า
                </Button>
                <Button variant="secondary" icon={QrCode} onClick={() => consumer('/verify')}>
                  สแกน QR
                </Button>
              </div>
              <Link to="/directory" onClick={() => switchRole('consumer')} className="mt-3 flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm text-primary hover:underline">
                <Store className="h-4 w-4" aria-hidden />
                ดูทำเนียบร้านค้าที่ผ่านการตรวจสอบ
              </Link>
            </Card>
          </section>
        </div>

        {/* ---------------------------------------------------------------- Demo */}
        <section aria-labelledby="home-demo" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div id="home-demo">
            <SectionHead
              eyebrow="Interactive Demo"
              title={`สาธิตระบบ ${allScenarios.length} เส้นทาง`}
              desc={`Scenario 1–${v1Count} (Consumer Protection) · Scenario ${v2Main[0]?.no}–${v2Main[v2Main.length - 1]?.no} (Marketplace & Trust Assessment) · ทางเลือก ${branches.map(scenarioCode).join(' / ')}`}
            />
          </div>
          <Card className="mb-3 border-2 border-primary/50 p-5" aria-label="Automation First (แนะนำ)">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">ใหม่ · เห็นความต่างของงานปกติกับกรณียกเว้น</p>
            <p className="mt-1 text-lg font-bold text-ink">Automation First, Human by Exception</p>
            <div className="mt-2 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-success-50 p-3">
                <p className="font-semibold text-ink">Scenario 14 — เส้นทางปกติ (ไม่ต้องใช้เจ้าหน้าที่)</p>
                <p className="text-ink-soft">Marketplace App → SME Trust → Auto-Fill → ประเมินอัตโนมัติ → Assessment Badge → ผู้บริโภคตรวจสอบ</p>
                <Button size="sm" className="mt-2" icon={Play} onClick={() => startAuto('s14')}>
                  เริ่ม Scenario 14
                </Button>
              </div>
              <div className="rounded-xl bg-warning-50 p-3">
                <p className="font-semibold text-ink">Scenario 15 — กรณียกเว้น (ส่งเจ้าหน้าที่)</p>
                <p className="text-ink-soft">เชื่อม Marketplace → ข้อมูลตัวตนขัดแย้ง → Manual Review Queue → เจ้าหน้าที่ตัดสิน → สถานะที่อัปเดต</p>
                <Button size="sm" variant="outline" className="mt-2" icon={Play} onClick={() => startAuto('s15')}>
                  เริ่ม Scenario 15
                </Button>
              </div>
            </div>
          </Card>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <Card className="border-primary/40 p-5" aria-label="Full Journey: Marketplace & Trust (แนะนำ)">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">แนะนำสำหรับผู้บริหาร</p>
              <p className="mt-1 text-lg font-bold text-ink">Full Journey — Marketplace & Trust Assessment</p>
              <p className="mt-1 text-sm text-ink-soft">Scenario 9 → 13: เชื่อมข้อมูลร้าน → วิเคราะห์ → ประเมิน → เจ้าหน้าที่พิจารณา → ผู้บริโภคตรวจสอบ ใช้ร้านเดียวกันตลอดทาง (≈ 30 นาที)</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button icon={Play} onClick={startV2}>
                  เริ่ม Full Journey: Marketplace & Trust
                </Button>
                <Button variant="outline" icon={MonitorPlay} onClick={() => nav('/demo?track=v2')}>
                  Scenario 9–13 · 9A · 9B
                </Button>
              </div>
            </Card>
            <Card className="p-5" aria-label="Demo อื่น">
              <p className="font-semibold text-ink">Full Journey: Consumer Protection และ Scenario เดี่ยว</p>
              <ul className="mt-2 space-y-2 text-sm">
                <li>
                  <Link to="/demo?track=v1" className="flex items-center gap-2 text-primary hover:underline">
                    <MonitorPlay className="h-4 w-4" aria-hidden />
                    Full Journey: Consumer Protection · Scenario 1–{v1Count} เดิม
                  </Link>
                </li>
                {branches.map((b) => (
                  <li key={b.id} className="text-ink-soft">
                    <b className="text-ink">{scenarioCode(b)}</b> {b.title}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <Card className="p-5">
            <p className="font-semibold text-ink">เกี่ยวกับต้นแบบนี้</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
              <li>Interactive Prototype แบบ Frontend-only ไม่มี Backend ไม่เรียก API และไม่ส่งข้อมูลออกนอกเบราว์เซอร์</li>
              <li>ข้อมูลบุคคล ร้านค้า และข้อมูล Marketplace ทั้งหมดเป็นข้อมูลสมมติ เก็บในเบราว์เซอร์ของคุณเท่านั้น (localStorage)</li>
              <li>ได้รับแรงบันดาลใจจากแนวคิดความร่วมมือระหว่างสภา SME และ สคบ. แต่ไม่ใช่ระบบที่หน่วยงานรับรองหรือใช้งานจริง</li>
              <li>ใช้ปุ่ม "Demo Mode" เพื่อสลับบทบาท เลือก Scenario และ Reset ข้อมูลได้ตลอดเวลา</li>
            </ul>
          </Card>
        </section>
      </main>
      <DemoPanel />
      <DemoController />
    </div>
  );
}
