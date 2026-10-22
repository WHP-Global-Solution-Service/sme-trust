import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, FlaskConical, GraduationCap, MessageSquareWarning, MonitorPlay, QrCode, Search, ShieldCheck, Store } from 'lucide-react';
import { useSessionStore, useOperatorStore } from '@/stores';
import { PrototypeBanner } from '@/components/feedback/Feedback';
import { Logo } from '@/components/common/Trust';
import { Button, Card } from '@/components/common/ui';
import { DemoPanel } from '@/components/layout/DemoPanel';
import { DEMO_INSET, DemoController, useDemoActive } from '@/components/layout/DemoController';
import { cn } from '@/utils/cn';
import { switchRole } from '@/components/layout/demo';
import { scenarios } from '@/mock/scenarios';

const pillars = [
  { icon: ShieldCheck, title: 'Prevention First', desc: 'ตรวจสอบร้านค้าก่อนเกิดปัญหา แทนการรอรับเรื่องร้องเรียน' },
  { icon: BadgeCheck, title: 'Trusted SME', desc: 'ใช้สถานะรับรองสร้างความมั่นใจบนช่องทางขายเดิม' },
  { icon: MessageSquareWarning, title: 'Consumer Protection', desc: 'ตรวจสอบร้าน แจ้งปัญหา และติดตามผลได้สะดวก' },
  { icon: GraduationCap, title: 'ลดภาระเจ้าหน้าที่', desc: 'คัดกรองเบื้องต้นและให้ร้านค้าแก้ไขก่อนส่งต่อ' },
];

export default function WelcomePage() {
  const nav = useNavigate();
  const set = useSessionStore((s) => s.set);
  const demoActive = useDemoActive();
  const opId = useSessionStore((s) => s.operatorId);
  const op = useOperatorStore((s) => s.items.find((o) => o.id === opId));

  return (
    <div className={cn('min-h-screen bg-bg', demoActive && `${DEMO_INSET} pb-24 lg:pb-0`)}>
      <PrototypeBanner />
      <header className="bg-primary text-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo light />
          <button onClick={() => set({ demoPanelOpen: true })} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-medium hover:bg-white/20">
            <FlaskConical className="h-4 w-4" />
            Demo Mode
          </button>
        </div>
      </header>
      <main>
      <div className="bg-primary text-white">
        <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-14 pt-6 sm:px-6 md:grid-cols-2 md:items-center md:pt-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              <FlaskConical className="h-3.5 w-3.5" />
              ระบบสาธิต (Prototype)
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              SME Trust Platform
              <span className="mt-1 block text-xl font-medium text-white/85 sm:text-2xl">ลงทะเบียน ตรวจสอบ และสร้างความน่าเชื่อถือให้ร้านค้าออนไลน์</span>
            </h1>
            <p className="mt-4 text-white/80">
              แนวคิดการทำงานร่วมกันระหว่างผู้ประกอบการ ผู้บริโภค และเจ้าหน้าที่ เพื่อป้องกันปัญหาการซื้อขายออนไลน์ก่อนเกิดเหตุ
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Button size="lg" variant="inverse" onClick={() => nav('/register')}>
                เริ่มลงทะเบียน
              </Button>
              <Button
                size="lg"
                variant="inverseOutline"
                onClick={() => {
                  if (!opId) set({ operatorId: 'OP-001' });
                  switchRole('merchant');
                  set({ merchantLoggedIn: false });
                  nav('/login');
                }}
              >
                เข้าสู่ระบบ
              </Button>
            </div>
            {op && <p className="mt-3 text-sm text-white/70">บัญชีล่าสุดบนอุปกรณ์นี้: {op.name}</p>}
            <Link to="/demo" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/15">
              <MonitorPlay className="h-5 w-5" />
              Demo Scenarios สำหรับการนำเสนอ ({scenarios.length} เรื่อง)
            </Link>
          </div>
          <Card className="p-5 text-ink">
            <p className="flex items-center gap-2 font-semibold">
              <Search className="h-5 w-5 text-primary" />
              ผู้บริโภค: ตรวจสอบร้านค้าก่อนซื้อ
            </p>
            <p className="mt-1 text-sm text-ink-soft">ไม่ต้องเข้าสู่ระบบ ค้นหาจากชื่อร้าน หมวดสินค้า หรือสแกน QR บนใบรับรอง</p>
            <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              <Button
                variant="secondary"
                icon={Search}
                onClick={() => {
                  switchRole('consumer');
                  nav('/check');
                }}
              >
                ตรวจสอบร้านค้า
              </Button>
              <Button
                variant="secondary"
                icon={QrCode}
                onClick={() => {
                  switchRole('consumer');
                  nav('/verify');
                }}
              >
                สแกน QR
              </Button>
            </div>
            <Link
              to="/directory"
              onClick={() => switchRole('consumer')}
              className="mt-3 flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm text-primary hover:underline"
            >
              <Store className="h-4 w-4" />
              ดูทำเนียบร้านค้าที่ผ่านการตรวจสอบ
            </Link>
          </Card>
        </section>
      </div>

      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <Card key={p.title} className="p-4">
              <p.icon className="h-6 w-6 text-primary" />
              <p className="mt-2 font-semibold text-ink">{p.title}</p>
              <p className="mt-1 text-sm text-ink-soft">{p.desc}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-6 p-5">
          <p className="font-semibold text-ink">เกี่ยวกับระบบสาธิตนี้</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>เป็น Interactive Prototype แบบ Frontend-only ไม่มี Backend และไม่เชื่อมต่อระบบภายนอกใด ๆ</li>
            <li>ข้อมูลบุคคลและร้านค้าทั้งหมดเป็นข้อมูลสมมติ เก็บไว้ในเบราว์เซอร์ของคุณเท่านั้น (localStorage)</li>
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
