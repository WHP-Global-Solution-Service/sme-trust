import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Circle, Clock, GitBranch, MonitorPlay, Play, PlayCircle, RotateCcw, Route, ShieldCheck, Store, Trophy, User, UserCog, type LucideIcon } from 'lucide-react';
import type { Role } from '@/types';
import { confirmDialog, toast } from '@/stores';
import { useDemoStore } from '@/stores/demo';
import { resetAllDemoData } from '@/stores/workflows';
import { findScenario, journeyScenarios, scenarioCode, trackOf, trackScenarios, TRACK_INFO } from '@/mock/scenarios';
import type { ScenarioDef, Track } from '@/demo/types';
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

/** หน้ารวม Demo Scenarios — v1 (1–8) และ v2 (9–13) แยกหมวด เลือกแบบเดี่ยว หรือสาธิตต่อเนื่องทีละชุด */
export default function DemoScenariosPage() {
  const nav = useNavigate();
  const d = useDemoStore();
  const { launch, dialog } = useScenarioLauncher();
  const active = findScenario(d.activeScenario);
  const inProgress = !!active && (d.status === 'running' || d.status === 'paused');
  const [params] = useSearchParams();
  const asked = params.get('track');
  // ?track=v1|v2 (ลิงก์จากหน้าแรก) เลือกแท็บเริ่มต้น — ไม่เช่นนั้นใช้ชุดที่กำลังสาธิตอยู่
  const [tab, setTab] = useState<Track>(() => (asked === 'v1' || asked === 'v2' ? asked : d.journeyMode ? d.journeyTrack ?? 'v1' : active ? trackOf(active) : 'v1'));

  const startSingle = async (sc: ScenarioDef) => {
    if (d.journeyMode && inProgress) {
      const r = await confirmDialog({ title: `เริ่ม Scenario ${scenarioCode(sc)} แบบเดี่ยว?`, body: 'การเริ่มแบบเดี่ยวจะรีเซ็ตข้อมูลสาธิตและออกจาก Full Journey ที่ค้างอยู่', confirmText: 'เริ่มแบบเดี่ยว' });
      if (!r.ok) return;
    }
    startScenario(sc.id, nav);
    toast.success(`เริ่ม Scenario ${scenarioCode(sc)}`, 'ใช้ตัวควบคุมการสาธิตเพื่อไปทีละขั้น');
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
            สำหรับผู้บริหารสภา SME และผู้แทนหน่วยงานคุ้มครองผู้บริโภค — <b>v1</b> 8 เรื่องราวด้านการยืนยันตัวตน การรับรอง การร้องเรียน และ AI Simulation · <b>v2</b> 5 เรื่องราวด้านการเชื่อมข้อมูลจากแพลตฟอร์มขายเดิมและการประเมินความน่าเชื่อถือจากหลายปัจจัย
          </p>
          {inProgress && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white/10 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm">
                {d.status === 'paused' ? 'หยุดไว้ที่' : 'กำลังสาธิต'} <b>Scenario {scenarioCode(active!)}: {active!.title}</b> · ขั้นที่ {d.stepIndex + 1}/{active!.steps.length}
                {d.journeyMode && (d.journeyTrack === 'v2' ? ' · Full Journey v2' : ' · Full Journey')}
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

        <JourneyCard track="v1" launch={launch} />
        <JourneyCard track="v2" launch={launch} />

        {/* Scenarios */}
        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-lg font-bold text-ink">เลือก Scenario แบบเดี่ยว</h2>
            <p className="text-sm text-ink-soft">Start Demo จะเตรียมข้อมูลจุดเริ่มต้นของเรื่องนั้นให้อัตโนมัติ</p>
          </div>
          <div role="tablist" aria-label="ชุดการสาธิต" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-card sm:inline-grid">
            {(['v1', 'v2'] as Track[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn('rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors sm:min-w-[240px]', tab === t ? 'bg-primary text-white' : 'text-ink-soft hover:bg-bg')}
              >
                <span className="block">{t === 'v1' ? 'v1 — Consumer Protection' : 'v2 — Marketplace Intelligence'}</span>
                <span className={cn('block text-xs font-normal', tab === t ? 'text-white/80' : 'text-ink-soft')}>
                  {TRACK_INFO[t].tagline}
                  {t === 'v2' && ' + ทางเลือก 9B'}
                </span>
              </button>
            ))}
          </div>
          <p className="mb-4 text-sm text-ink-soft">{TRACK_INFO[tab].desc}</p>
          <div className="grid gap-4 lg:grid-cols-2" role="tabpanel" aria-label={TRACK_INFO[tab].name}>
            {trackScenarios(tab).map((sc) => (
              <ScenarioCard key={sc.id} sc={sc} onStart={() => startSingle(sc)} />
            ))}
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

const JOURNEY_TEXT: Record<Track, { title: string; desc: string; start: string; cont: string; restart: string; confirm: string }> = {
  v1: {
    title: 'สาธิตระบบแบบต่อเนื่อง (Full Journey Demo)',
    desc: 'สาธิต Scenario 1 → 8 อย่างต่อเนื่อง ใช้บัญชี ร้านค้า และเรื่องร้องเรียนเดียวกันข้ามบทบาท ไม่ต้องเลือกเมนูหรือสลับบทบาทเอง — ระบบอธิบายทุกครั้งที่เปลี่ยนมุมมอง (≈ 45 นาที)',
    start: 'Start Full Journey',
    cont: 'Continue Journey',
    restart: 'Restart Full Journey',
    confirm: 'เริ่ม Full Journey',
  },
  v2: {
    title: 'Full Journey v2 — Marketplace Intelligence',
    desc: 'สาธิต Scenario 9 → 13 ต่อเนื่อง: เชื่อมข้อมูล Shopee/Lazada (จำลอง) → วิเคราะห์ → ประเมิน → เจ้าหน้าที่พิจารณา → ผู้บริโภคตรวจสอบ ใช้ร้าน การเชื่อมต่อ ผลประเมิน และคำขอเดียวกันตลอดทาง (≈ 30 นาที)',
    start: 'เริ่ม Journey v2',
    cont: 'สาธิต Journey v2 ต่อ',
    restart: 'เริ่ม Journey v2 ใหม่',
    confirm: 'เริ่ม Journey v2 จากต้น',
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
    <section className={cn('rounded-card border bg-white p-5 shadow-card', v2 ? 'border-info/30' : 'border-primary/30')} aria-label={t.title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={cn('text-xs font-semibold uppercase tracking-wide', v2 ? 'text-info' : 'text-primary')}>{TRACK_INFO[track].name}</p>
          <h2 className="mt-0.5 flex items-center gap-2 text-lg font-bold text-ink">
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
            <b className="text-ink">ทางเลือก {scenarioCode(b)}:</b> {b.title} — เล่นแทรกได้จากหน้าสรุปของ Scenario 9 หรือเลือกแบบเดี่ยวด้านล่าง
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

/** การ์ด Scenario แบบเดี่ยว */
function ScenarioCard({ sc, onStart }: { sc: ScenarioDef; onStart: () => void }) {
  const st = scenarioStatus(sc.id);
  const v2 = trackOf(sc) === 'v2';
  const code = scenarioCode(sc);
  return (
    <article className={cn('flex flex-col rounded-card border bg-white shadow-card', st === 'current' ? 'border-primary ring-2 ring-primary/20' : 'border-line')}>
      <div className="flex items-start gap-3 border-b border-line p-5">
        <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-white', v2 ? 'bg-info' : sc.no >= 7 ? 'bg-secondary' : 'bg-primary')}>{code}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-ink">{sc.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
            <Clock className="h-3.5 w-3.5" />
            {sc.duration} · {sc.steps.length} ขั้นตอน
            {!v2 && sc.no >= 7 && <Badge tone="error">AI Simulation</Badge>}
            {v2 && <Badge tone="info">{sc.branch ? 'เส้นทางทางเลือก' : 'Marketplace (จำลอง)'}</Badge>}
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
