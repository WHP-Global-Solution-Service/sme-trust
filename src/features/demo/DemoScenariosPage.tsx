import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Circle, Clock, MonitorPlay, Play, PlayCircle, RotateCcw, Route, ShieldCheck, Store, User, UserCog, type LucideIcon } from 'lucide-react';
import type { Role } from '@/types';
import { confirmDialog, toast } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { resetAllDemoData } from '@/stores/workflows';
import { findScenario, scenarios } from '@/mock/scenarios';
import type { ScenarioDef } from '@/demo/types';
import { resetScenarioData, resumeDemo, scenarioStatus, startJourney, startScenario } from '@/demo/controller';
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

/** หน้ารวม Demo Scenarios — เลือกแบบเดี่ยว หรือสาธิตต่อเนื่องทั้ง 8 เรื่อง */
export default function DemoScenariosPage() {
  const nav = useNavigate();
  const d = useDemoStore();
  const { launch, dialog } = useScenarioLauncher();
  const active = findScenario(d.activeScenario);
  const inProgress = !!active && (d.status === 'running' || d.status === 'paused');
  const journeyStarted = d.journeyMode || d.completed.length > 0;

  const startSingle = async (sc: ScenarioDef) => {
    if (d.journeyMode && inProgress) {
      const r = await confirmDialog({ title: `เริ่ม Scenario ${sc.no} แบบเดี่ยว?`, body: 'การเริ่มแบบเดี่ยวจะรีเซ็ตข้อมูลสาธิตและออกจาก Full Journey ที่ค้างอยู่', confirmText: 'เริ่มแบบเดี่ยว' });
      if (!r.ok) return;
    }
    startScenario(sc.id, nav);
    toast.success(`เริ่ม Scenario ${sc.no}`, 'ใช้ตัวควบคุมการสาธิตเพื่อไปทีละขั้น');
  };

  const jump = async (sc: ScenarioDef) => {
    const st = scenarioStatus(sc.id);
    if (st === 'completed') return nav(`/demo/complete/${sc.id}`);
    if (st === 'current') return resumeDemo(nav);
    const r = await confirmDialog({
      title: `ข้ามไป Scenario ${sc.no}?`,
      body: 'ข้อมูลที่สร้างไว้ยังอยู่ และ Scenario ที่ค้างอยู่จะหยุดที่ขั้นปัจจุบัน หากข้อมูลจาก Scenario ก่อนหน้ายังไม่ครบ ระบบจะให้เลือกว่าจะกลับไปทำให้ครบหรือใช้ข้อมูลตัวอย่าง',
      confirmText: 'ข้ามไป',
    });
    if (r.ok) launch(sc.id, 'jump');
  };

  return (
    <DemoFrame>
      <section className="bg-primary text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
            <MonitorPlay className="h-3.5 w-3.5" />
            Demo Presentation Mode
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">การสาธิตแนวคิด SME Trust Platform</h1>
          <p className="mt-2 max-w-3xl text-white/85">
            สำหรับผู้บริหารสภา SME และผู้แทนหน่วยงานคุ้มครองผู้บริโภค — 8 เรื่องราวตั้งแต่การยืนยันตัวตน การรับรอง การร้องเรียน การพิจารณาอุทธรณ์ จนถึง AI Simulation ที่ช่วยป้องกันปัญหาและแก้ไขข้อร้องเรียน
          </p>
          {inProgress && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white/10 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm">
                {d.status === 'paused' ? 'หยุดไว้ที่' : 'กำลังสาธิต'} <b>Scenario {active!.no}: {active!.title}</b> · ขั้นที่ {d.stepIndex + 1}/{active!.steps.length}
                {d.journeyMode && ' · Full Journey'}
              </p>
              <Button variant="inverse" icon={Play} onClick={() => resumeDemo(nav)}>
                สาธิตต่อ
              </Button>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <PrototypeDisclaimer />

        {/* Full Journey */}
        <section className="rounded-card border border-primary/30 bg-white p-5 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                <Route className="h-5 w-5 text-primary" />
                สาธิตระบบแบบต่อเนื่อง (Full Journey Demo)
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-ink-soft">
                สาธิต Scenario 1 → 8 อย่างต่อเนื่อง ใช้บัญชี ร้านค้า และเรื่องร้องเรียนเดียวกันข้ามบทบาท ไม่ต้องเลือกเมนูหรือสลับบทบาทเอง — ระบบอธิบายทุกครั้งที่เปลี่ยนมุมมอง (≈ 45 นาที)
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              {d.journeyMode && inProgress ? (
                <Button icon={Play} onClick={() => resumeDemo(nav)}>
                  Continue Journey
                </Button>
              ) : (
                <Button
                  icon={Play}
                  onClick={async () => {
                    if (journeyStarted || inProgress) {
                      const r = await confirmDialog({ title: 'เริ่ม Full Journey', body: 'ระบบจะรีเซ็ตข้อมูลสาธิตเป็นค่าเริ่มต้นครั้งเดียว แล้วเริ่ม Scenario 1', confirmText: 'เริ่ม Full Journey' });
                      if (!r.ok) return;
                    }
                    startJourney(nav);
                  }}
                >
                  Start Full Journey
                </Button>
              )}
              {journeyStarted && (
                <Button
                  variant="outline"
                  icon={RotateCcw}
                  onClick={async () => {
                    const r = await confirmDialog({ title: 'Restart Full Journey', body: 'ล้างข้อมูลทั้งหมดที่สร้างระหว่าง Journey และเริ่ม Scenario 1 ใหม่', confirmText: 'เริ่มใหม่ทั้งหมด', tone: 'danger' });
                    if (r.ok) startJourney(nav);
                  }}
                >
                  Restart Full Journey
                </Button>
              )}
            </div>
          </div>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {scenarios.map((sc) => {
              const st = scenarioStatus(sc.id);
              const chip = STATUS_CHIP[st];
              return (
                <li key={sc.id}>
                  <button
                    onClick={() => (journeyStarted ? jump(sc) : undefined)}
                    disabled={!journeyStarted}
                    className={cn(
                      'flex h-full w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-default',
                      st === 'current' ? 'border-primary bg-primary-50' : st === 'completed' ? 'border-success/30 bg-success-50/50' : 'border-line',
                      journeyStarted && 'hover:border-primary/40',
                    )}
                  >
                    <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold', st === 'completed' ? 'bg-success text-white' : st === 'current' ? 'bg-primary text-white' : 'bg-bg text-ink-soft')}>{sc.no}</span>
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug text-ink">{sc.title}</span>
                      {journeyStarted && (
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
          {journeyStarted && <p className="mt-2 text-xs text-ink-soft">กดที่ Scenario เพื่อดูสรุป (เสร็จแล้ว) สาธิตต่อ (กำลังทำ) หรือข้ามไป (ยังไม่เริ่ม — ระบบขอยืนยันก่อน)</p>}
        </section>

        {/* Scenarios */}
        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-lg font-bold text-ink">เลือก Scenario แบบเดี่ยว</h2>
            <p className="text-sm text-ink-soft">Start Demo จะเตรียมข้อมูลจุดเริ่มต้นของเรื่องนั้นให้อัตโนมัติ</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {scenarios.map((sc) => {
              const st = scenarioStatus(sc.id);
              return (
                <article key={sc.id} className={cn('flex flex-col rounded-card border bg-white shadow-card', st === 'current' ? 'border-primary ring-2 ring-primary/20' : 'border-line')}>
                  <div className="flex items-start gap-3 border-b border-line p-5">
                    <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white', sc.no >= 7 ? 'bg-secondary' : 'bg-primary')}>{sc.no}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold leading-snug text-ink">{sc.title}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                        <Clock className="h-3.5 w-3.5" />
                        {sc.duration} · {sc.steps.length} ขั้นตอน
                        {sc.no >= 7 && <Badge tone="error">AI Simulation</Badge>}
                        {st !== 'not_started' && <Badge tone={STATUS_CHIP[st].tone}>{STATUS_CHIP[st].label}</Badge>}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4 p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">วัตถุประสงค์</p>
                      <p className="mt-1 text-sm text-ink">{sc.objective}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">กลุ่มผู้ใช้ที่เกี่ยวข้อง</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {sc.audience.map((r) => {
                          const a = AUDIENCE[r];
                          return (
                            <span key={r} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', a.cls)}>
                              <a.icon className="h-3.5 w-3.5" />
                              {a.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    {sc.caseNote && <p className="rounded-lg bg-info-50 px-3 py-2 text-xs text-[#1d4ab8]">{sc.caseNote}</p>}
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-soft">ขั้นตอนการสาธิต ({sc.steps.length})</summary>
                      <ol className="mt-2 space-y-1.5">
                        {sc.steps.map((s, k) => (
                          <li key={s.id} className="flex gap-2 text-sm">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-bg text-[11px] font-semibold text-ink-soft">{k + 1}</span>
                            <span className="min-w-0 text-ink">
                              {s.title} <span className="text-xs text-ink-soft">· {AUDIENCE[s.role].label}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                    <p className="border-l-4 border-primary/40 pl-3 text-sm italic text-ink">“{sc.keyMessage}”</p>
                    <div className="rounded-xl bg-bg p-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">ประโยชน์</p>
                      <dl className="space-y-1.5 text-sm">
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
                  </div>
                  <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row">
                    <Button icon={Play} className="sm:flex-1" onClick={() => startSingle(sc)}>
                      Start Demo
                    </Button>
                    <Button
                      variant="outline"
                      icon={RotateCcw}
                      onClick={async () => {
                        const r = await confirmDialog({ title: `Reset Scenario ${sc.no}`, body: 'ข้อมูลสาธิตจะกลับเป็นจุดเริ่มต้นของเรื่องนี้ (แบบเดี่ยว) และหยุดการสาธิตที่ค้างอยู่', confirmText: 'Reset Scenario' });
                        if (!r.ok) return;
                        resetScenarioData(sc.id);
                        toast.success(`Reset Scenario ${sc.no} แล้ว`, 'พร้อมกด Start Demo');
                      }}
                    >
                      Reset Scenario
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col items-start gap-3 rounded-card border border-line bg-white p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-ink-soft">Start Demo, Reset Scenario และ Restart Scenario คืนข้อมูลเป็นจุดเริ่มต้นของเรื่องนั้นเสมอ จึงสาธิตซ้ำได้โดยไม่ต้องแก้ไขโค้ด</p>
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
        </section>
      </main>
      {dialog}
    </DemoFrame>
  );
}
