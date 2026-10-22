import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertOctagon, FlaskConical, Home, LayoutGrid } from 'lucide-react';
import { useSessionStore } from '@/stores';
import { PrototypeBanner } from '@/components/feedback/Feedback';
import { Logo } from '@/components/common/Trust';
import { DemoPanel } from '@/components/layout/DemoPanel';

/** โครงหน้าสำหรับหน้ารวม/สรุปการสาธิต */
export function DemoFrame({ children, menu = false }: { children: ReactNode; menu?: boolean }) {
  const set = useSessionStore((s) => s.set);
  return (
    <div className="min-h-screen bg-bg">
      <PrototypeBanner />
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            {menu && (
              <Link to="/demo" className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-soft hover:bg-bg">
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Demo Menu</span>
              </Link>
            )}
            <Link to="/" className="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-ink-soft hover:bg-bg sm:flex">
              <Home className="h-4 w-4" />
              หน้าแรก
            </Link>
            <button onClick={() => set({ demoPanelOpen: true })} className="flex h-10 items-center gap-1.5 rounded-xl border border-secondary/30 bg-secondary-50 px-3 text-sm font-medium text-secondary hover:bg-secondary/10">
              <FlaskConical className="h-4 w-4" />
              Demo Mode
            </button>
          </div>
        </div>
      </header>
      {children}
      <DemoPanel />
    </div>
  );
}

export function PrototypeDisclaimer() {
  return (
    <section className="rounded-card border-2 border-secondary/40 bg-white p-5" role="note" aria-label="Prototype Disclaimer">
      <h2 className="flex items-center gap-2 text-lg font-bold text-secondary">
        <AlertOctagon className="h-6 w-6 shrink-0" />
        ข้อจำกัดความรับผิดชอบ (Prototype Disclaimer)
      </h2>
      <ul className="mt-3 grid gap-2 text-sm text-ink sm:grid-cols-2">
        {[
          <>เป็น<b>ระบบสาธิตต้นแบบ</b>เพื่อแสดงแนวคิดเท่านั้น ยังไม่ใช่ระบบที่เปิดให้บริการจริง</>,
          <><b>ผลตรวจสอบ ใบรับรอง Badge สถานะความเสี่ยง และตัวเลขสถิติทั้งหมดเป็นข้อมูลจำลอง</b> ไม่มีผลทางกฎหมาย และไม่ใช่การรับรองจากสภา SME หรือ สคบ.</>,
          <><b>AI Simulation</b> ใช้กฎที่กำหนดไว้ล่วงหน้าในเบราว์เซอร์ ไม่ใช่ AI Model จริง ไม่เชื่อมต่อ AI API และผลไม่ใช่คำวินิจฉัยทางกฎหมาย</>,
          <>ไม่เชื่อมต่อระบบภายนอกหรือส่งเรื่องเข้าหน่วยงานจริง บุคคลและร้านค้าเป็นข้อมูลสมมติ เก็บไว้ในเบราว์เซอร์ที่ใช้สาธิตเท่านั้น</>,
        ].map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
