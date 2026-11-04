import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, Database, GitBranch, LayoutGrid, Repeat, Trophy } from 'lucide-react';
import { confirmDialog } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { findScenario, journeyScenarios, scenarioCode, trackOf } from '@/mock/scenarios';
import { nextScenarioId, nextUnfinished, prevScenarioId, restartScenario, startScenario } from '@/demo/controller';
import { Badge, Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { DemoFrame } from './DemoFrame';
import { BENEFIT_ROWS } from './DemoScenariosPage';
import { useScenarioLauncher } from './ScenarioLauncher';

/** Scenario Completion Screen */
export default function DemoCompletePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const d = useDemoStore();
  const { launch, dialog } = useScenarioLauncher();
  const sc = findScenario(id);
  if (!sc) return <NotFoundPage />;
  const done = d.completed.includes(sc.id);
  const ctx = d.results[sc.id] ?? (d.activeScenario === sc.id ? d.current : {});
  const track = trackOf(sc);
  const seq = journeyScenarios(track);
  const code = scenarioCode(sc);
  const nextId = nextScenarioId(sc.id);
  const isLast = !sc.branch && !nextId;
  const prev = prevScenarioId(sc.id);
  const resume = sc.branch && d.journeyMode && d.journeyTrack === track ? nextUnfinished(track) : undefined;
  const resumeSc = findScenario(resume);
  const position = sc.branch ? `เส้นทางทางเลือก ${code} ของ v2` : track === 'v2' ? `Scenario ${code} · ลำดับ ${seq.findIndex((s) => s.id === sc.id) + 1} จาก ${seq.length} ของ v2` : `Scenario ${code} จาก ${seq.length}`;
  const summaryPath = track === 'v2' ? '/demo/v2/summary' : '/demo/overview';
  const primary = resume
    ? { label: `กลับสู่ Full Journey v2: Scenario ${resumeSc ? scenarioCode(resumeSc) : ''}`, icon: ArrowRight, run: () => launch(resume) }
    : isLast || sc.branch
      ? { label: track === 'v2' ? 'ดูสรุปผลกระทบ (Executive Impact Summary)' : 'ดูสรุปภาพรวม SME Trust Platform', icon: Trophy, run: () => nav(summaryPath) }
      : { label: sc.nextCta ?? 'Continue Next Scenario', icon: ArrowRight, run: () => launch(nextId!) };
  const isActive = d.activeScenario === sc.id;

  const replay = async () => {
    const r = await confirmDialog({
      title: `Replay Scenario ${code}`,
      body: isActive ? 'ข้อมูลจะกลับเป็นจุดเริ่มต้นของ Scenario นี้ (ผลจาก Scenario ก่อนหน้ายังอยู่ และไม่สร้างข้อมูลซ้ำ)' : 'ระบบจะเตรียมข้อมูลจุดเริ่มต้นของเรื่องนี้แบบเดี่ยว (รีเซ็ตข้อมูลสาธิต)',
      confirmText: 'เล่นซ้ำ',
    });
    if (!r.ok) return;
    if (isActive) restartScenario(nav);
    else startScenario(sc.id, nav);
  };

  return (
    <DemoFrame menu>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <section className="rounded-card border border-success/30 bg-white p-6 text-center shadow-card">
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
          <p className="mt-2 text-sm text-ink-soft">
            {position}
            {d.journeyMode && (d.journeyTrack === 'v2' ? ' · Full Journey v2' : ' · Full Journey')}
          </p>
          <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{sc.title}</h1>
          <div className="mt-2 flex justify-center">
            <Badge tone={done ? 'success' : 'warning'}>{done ? 'Completed' : 'ยังไม่จบ Scenario นี้'}</Badge>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] italic text-ink">“{sc.keyMessage}”</p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-card border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 font-semibold text-ink">ขั้นตอนที่ทำสำเร็จ</h2>
            <ol className="space-y-1.5">
              {sc.steps.map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-ink">
                  <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', done ? 'text-success' : 'text-line')} />
                  {s.title}
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-card border border-line bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink">
              <Database className="h-4 w-4 text-primary" />
              สิ่งที่เปลี่ยนแปลงใน Mock State
            </h2>
            <ul className="space-y-1.5 text-sm text-ink">
              {sc.summary(ctx).map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
            {ctx.notice && <p className="mt-3 rounded-lg bg-warning-50 px-2.5 py-2 text-xs text-[#7a4705]">ใช้ข้อมูลตัวอย่าง: {ctx.notice}</p>}
            <p className="mt-3 text-xs text-ink-soft">คำนวณจากข้อมูลจำลองในเบราว์เซอร์ — ไม่ใช่ข้อมูลหรือผลรับรองจริง</p>
          </section>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          {BENEFIT_ROWS.map((b) => (
            <div key={b.key} className="rounded-card border border-line bg-white p-4 shadow-card">
              <p className={cn('flex items-center gap-1.5 text-sm font-semibold', b.cls)}>
                <b.icon className="h-4 w-4" />
                {b.key === 'ocpb' ? 'ลดภาระเจ้าหน้าที่ (สคบ.)' : `ประโยชน์ต่อ${b.label === 'SME' ? 'ผู้ประกอบการ' : b.label}`}
              </p>
              <p className="mt-1.5 text-sm text-ink">{sc.benefits[b.key]}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2 rounded-card border border-line bg-white p-4 shadow-card sm:flex-row sm:flex-wrap">
          <Button size="lg" icon={primary.icon} className="sm:flex-1" onClick={primary.run}>
            {primary.label}
          </Button>
          {sc.id === 's9' && (
            <Button size="lg" variant="outline" icon={GitBranch} onClick={() => launch('s9b')}>
              ทางเลือก 9B: ร้านที่ไม่มี Marketplace
            </Button>
          )}
          <Button size="lg" variant="outline" icon={Repeat} onClick={replay}>
            Replay Scenario
          </Button>
          <Button size="lg" variant="ghost" icon={LayoutGrid} onClick={() => nav('/demo')}>
            Back to Demo Menu
          </Button>
        </section>
        {prev && d.completed.includes(prev) && (
          <Link to={`/demo/complete/${prev}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ChevronLeft className="h-4 w-4" />
            ย้อนดูสรุป Scenario ก่อนหน้า
          </Link>
        )}
      </main>
      {dialog}
    </DemoFrame>
  );
}
