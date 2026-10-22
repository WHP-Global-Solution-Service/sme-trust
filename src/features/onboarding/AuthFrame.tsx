import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, FlaskConical } from 'lucide-react';
import { useSessionStore } from '@/stores';
import { PrototypeBanner } from '@/components/feedback/Feedback';
import { Logo } from '@/components/common/Trust';
import { DemoPanel } from '@/components/layout/DemoPanel';
import { DEMO_INSET, DemoController, useDemoActive } from '@/components/layout/DemoController';
import { cn } from '@/utils/cn';

/** Layout สำหรับหน้าลงทะเบียน/เข้าสู่ระบบ (Mobile-first, คอลัมน์เดียว) */
export function AuthFrame({ children, back, onBack }: { children: ReactNode; back?: string; onBack?: () => void }) {
  const set = useSessionStore((s) => s.set);
  const demoActive = useDemoActive();
  return (
    <div className={cn('min-h-screen bg-bg', demoActive && DEMO_INSET)}>
      <PrototypeBanner />
      <header className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
        {onBack ? (
          <button onClick={onBack} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white" aria-label="ย้อนกลับ">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : back ? (
          <Link to={back} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white" aria-label="ย้อนกลับ">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : null}
        <Link to="/">
          <Logo />
        </Link>
        <button onClick={() => set({ demoPanelOpen: true })} className="ml-auto flex h-9 items-center gap-1.5 rounded-xl border border-secondary/30 bg-secondary-50 px-3 text-sm font-medium text-secondary">
          <FlaskConical className="h-4 w-4" />
          Demo
        </button>
      </header>
      <main className={cn('mx-auto max-w-md px-4 pt-2', demoActive ? 'pb-32 lg:pb-16' : 'pb-16')}>{children}</main>
      <DemoPanel />
      <DemoController />
    </div>
  );
}
