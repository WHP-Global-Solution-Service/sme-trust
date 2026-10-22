import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, Circle, Cpu, GraduationCap, LayoutDashboard, LayoutGrid, MessageSquareWarning, RotateCcw, ShieldAlert, Store, Trophy, Users } from 'lucide-react';
import { useAiHistoryStore, confirmDialog, useSessionStore } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { useStats } from '@/hooks/useStats';
import { scenarios } from '@/mock/scenarios';
import { startJourney } from '@/demo/controller';
import { Button, Stat } from '@/components/common/ui';
import { DemoFrame, PrototypeDisclaimer } from './DemoFrame';

/** สรุปภาพรวม SME Trust Platform — แสดงผลลัพธ์จากข้อมูลจำลองเท่านั้น */
export default function DemoOverviewPage() {
  const nav = useNavigate();
  const d = useDemoStore();
  const filter = useMemo(() => ({ province: '', months: 0 }), []);
  const k = useStats(filter).kpi;
  const aiCount = useAiHistoryStore((s) => s.items.length);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');

  return (
    <DemoFrame menu>
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Trophy className="h-9 w-9" />
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">สรุปภาพรวม SME Trust Platform</h1>
          <p className="mt-2 max-w-3xl text-white/85">
            การป้องกันก่อนเกิดปัญหา การรับรองที่ตรวจสอบได้ การแก้ไขข้อพิพาทที่ร้านค้า และ AI Simulation ที่ช่วยผู้ประกอบการ — ผลลัพธ์ด้านล่างคำนวณจากข้อมูลจำลองในการสาธิตครั้งนี้
          </p>
          <p className="mt-3 text-sm text-white/80">
            สาธิตแล้ว {d.completed.length}/{scenarios.length} Scenario
          </p>
        </div>
      </section>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section>
          <h2 className="mb-3 text-lg font-bold text-ink">ผลลัพธ์จากข้อมูลจำลอง</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="ร้านค้าที่ลงทะเบียน" value={k.registered} icon={Store} />
            <Stat label="ร้านที่ตรวจสอบแล้ว" value={k.verified} icon={BadgeCheck} tone="success" hint={`${pct(k.verified, k.registered)} ของร้านที่ลงทะเบียน`} />
            <Stat label="ข้อร้องเรียนทั้งหมด" value={k.complaints} icon={MessageSquareWarning} tone="info" />
            <Stat label="ร้านค้าแก้ไขสำเร็จ" value={k.resolvedByMerchant} icon={CheckCircle2} tone="success" hint={`${pct(k.resolvedByMerchant, k.complaints)} — ไม่ต้องใช้เจ้าหน้าที่`} />
            <Stat label="คำเตือนที่ออก" value={k.warningsIssued} icon={ShieldAlert} tone="warning" />
            <Stat label="ผู้เข้าอบรม" value={k.trainees} icon={GraduationCap} hint={`ผ่านอย่างน้อย 1 หลักสูตร ${k.traineesPassed} คน`} />
            <Stat label="จำนวน SME" value={k.totalSme} icon={Users} />
            <Stat label="การวิเคราะห์ AI Simulation" value={aiCount} icon={Cpu} tone="error" hint="ประวัติล่าสุดในเบราว์เซอร์นี้" />
          </div>
          <p className="mt-2 text-xs text-ink-soft">ตัวเลขทั้งหมดเป็นข้อมูลสาธิต ไม่ใช่สถิติจริงของหน่วยงานใด</p>
        </section>

        <section className="rounded-card border border-line bg-white p-5 shadow-card">
          <h2 className="mb-3 text-lg font-bold text-ink">เส้นทางการสาธิต</h2>
          <ol className="space-y-3">
            {scenarios.map((sc) => {
              const done = d.completed.includes(sc.id);
              return (
                <li key={sc.id} className="flex gap-3">
                  {done ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-line" />}
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {sc.no}. {sc.title}
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
        </section>

        <PrototypeDisclaimer />

        <section className="flex flex-col gap-2 sm:flex-row">
          <Button
            icon={LayoutDashboard}
            onClick={() => {
              useSessionStore.getState().set({ role: 'admin', officerId: 'AD-001' });
              nav('/admin');
            }}
          >
            ดู Admin Dashboard
          </Button>
          <Button
            variant="outline"
            icon={RotateCcw}
            onClick={async () => {
              const r = await confirmDialog({ title: 'Restart Full Journey', body: 'ล้างข้อมูลทั้งหมดและเริ่ม Scenario 1 ใหม่', confirmText: 'เริ่มใหม่ทั้งหมด', tone: 'danger' });
              if (r.ok) startJourney(nav);
            }}
          >
            Restart Full Journey
          </Button>
          <Button variant="ghost" icon={LayoutGrid} onClick={() => nav('/demo')}>
            Back to Demo Menu
          </Button>
        </section>
      </main>
    </DemoFrame>
  );
}
