import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ChevronUp, Info, Link2, LayoutGrid, Lightbulb, Lock, Pause, Repeat, RotateCcw, Undo2, X } from 'lucide-react';
import type { Role } from '@/types';
import { domainStores, useSessionStore, confirmDialog, toast } from '@/stores';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import { useDemoStore } from '@/stores/demo';
import { journeyScenarios, scenarioCode, stepInstruction, trackOf } from '@/mock/scenarios';
import { ROLE_LABEL } from '@/constants/labels';
import { activeScenario, back, gateState, next, pauseDemo, restartJourney, restartScenario, returnToStep, scenarioStatus, stepRoute } from '@/demo/controller';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';

/** แผงควบคุมกำลังแสดงอยู่หรือไม่ — ใช้เว้นพื้นที่ไม่ให้บังปุ่มของแอป */
export function useDemoActive() {
  const d = useDemoStore();
  return !!d.activeScenario && d.status === 'running';
}

/** คลาสเว้นพื้นที่ให้แผงควบคุม: Desktop เว้นขวา / Mobile เว้นล่าง */
export const DEMO_INSET = 'lg:mr-[360px]';

type Pending = { dir: 'next' | 'back'; to: Role; message: string };

export function DemoController({ aboveBottomNav = false }: { aboveBottomNav?: boolean }) {
  const nav = useNavigate();
  const loc = useLocation();
  const d = useDemoStore();
  const role = useSessionStore((s) => s.role);
  // ติดตามข้อมูลที่ใช้ตรวจเงื่อนไข เพื่อให้ปุ่ม "ถัดไป" อัปเดตทันทีเมื่อผู้ใช้ทำขั้นตอนสำเร็จ
  domainStores.forEach((s) => (s as unknown as (sel: (x: { items: unknown[] }) => unknown) => unknown)((x) => x.items));
  useAiWorkspaceStore();
  useSessionStore();
  const [sheet, setSheet] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<Pending>();

  const sc = activeScenario();
  if (!sc || d.status !== 'running') return null;
  const i = Math.min(d.stepIndex, sc.steps.length - 1);
  const step = sc.steps[i];
  const gate = gateState(step);
  const here = loc.pathname + loc.search;
  const onRoute = role === step.role && here === stepRoute(step);
  const isLast = i === sc.steps.length - 1;
  const pct = Math.round(((i + 1) / sc.steps.length) * 100);
  const nextLabel = step.nextLabel ?? (isLast ? 'จบ Scenario และดูสรุป' : 'ถัดไป');
  const code = scenarioCode(sc);
  const track = d.journeyMode ? d.journeyTrack ?? 'v1' : trackOf(sc);
  const seq = journeyScenarios(track);
  const pos = seq.findIndex((s) => s.id === sc.id) + 1;
  const journeyLabel = track === 'v2' ? 'Full Journey v2 — Marketplace Intelligence' : 'Full Journey Demo';
  const journeyPos = sc.branch ? 'เส้นทางทางเลือก' : track === 'v2' ? `Scenario ${pos}/${seq.length} ของ v2` : `Scenario ${sc.no}/${seq.length}`;
  // บริบทที่ส่งต่อตลอด Journey v2 (Merchant / Connection / Assessment / Application)
  const ids = trackOf(sc) === 'v2'
    ? ([
        ['Merchant', d.current.merchantId],
        ['Connection', d.current.connectionId],
        ['Assessment', d.current.assessmentId],
        ['Application', d.current.applicationId],
        ['Certificate', d.current.certId],
      ].filter(([, v]) => !!v) as [string, string][])
    : [];

  const doNext = (confirmed = false) => {
    const r = next(nav, here, confirmed);
    if (r === 'transition') {
      const to = sc.steps[i + 1];
      setPending({ dir: 'next', to: to.role, message: to.transition ?? `ขั้นตอนต่อไปดำเนินการในมุม${ROLE_LABEL[to.role]}` });
    } else {
      setPending(undefined);
      setSheet(false);
    }
  };
  const doBack = (confirmed = false) => {
    const r = back(nav, here, confirmed);
    if (r === 'transition') {
      const to = sc.steps[i - 1];
      setPending({ dir: 'back', to: to.role, message: `ย้อนกลับไปขั้น "${to.title}" ในมุม${ROLE_LABEL[to.role]} (ข้อมูลที่ทำไปแล้วยังอยู่)` });
    } else {
      setPending(undefined);
      setSheet(false);
    }
  };
  const doRestart = async () => {
    const r = await confirmDialog({
      title: `เริ่ม Scenario ${sc.no} ใหม่`,
      body: d.journeyMode ? 'ข้อมูลจะกลับเป็นจุดเริ่มต้นของ Scenario นี้ — ผลจาก Scenario ก่อนหน้าใน Full Journey ยังอยู่ และไม่สร้างข้อมูลซ้ำ' : 'ข้อมูลจะกลับเป็นจุดเริ่มต้นของ Scenario นี้ และไม่สร้างข้อมูลซ้ำ',
      confirmText: 'เริ่มใหม่',
    });
    if (!r.ok) return;
    restartScenario(nav);
    setSheet(false);
    toast.success(`เริ่ม Scenario ${sc.no} ใหม่แล้ว`);
  };
  const doRestartJourney = async () => {
    const r = await confirmDialog({ title: `Restart ${journeyLabel}`, body: 'ล้างข้อมูลทั้งหมดที่สร้างระหว่าง Journey และเริ่ม Scenario แรกของชุดนี้ใหม่', confirmText: 'เริ่ม Journey ใหม่', tone: 'danger' });
    if (!r.ok) return;
    restartJourney(nav);
    setSheet(false);
  };
  const doPause = async () => {
    const r = await confirmDialog({ title: 'ออกจากโหมดสาธิตชั่วคราว?', body: 'ข้อมูลและขั้นตอนถูกเก็บไว้ กลับมาสาธิตต่อได้จากหน้ารวม Demo Scenarios', confirmText: 'ออกจากโหมดสาธิต' });
    if (r.ok) pauseDemo();
  };

  const header = (
    <div className="bg-ink px-4 pb-3 pt-2.5 text-white">
      {d.journeyMode && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] text-white/70">
            <span>{journeyLabel}</span>
            <span>{journeyPos}</span>
          </div>
          <div className="mt-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${seq.length}, minmax(0, 1fr))` }} aria-label="ความคืบหน้าภาพรวม">
            {seq.map((s) => {
              const st = scenarioStatus(s.id);
              return <span key={s.id} className={cn('h-1 rounded-full', st === 'completed' ? 'bg-success' : st === 'current' ? 'bg-white' : 'bg-white/20')} />;
            })}
          </div>
        </div>
      )}
      <p className="truncate text-sm font-semibold">
        Scenario {code}: {sc.title}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="shrink-0 text-xs text-white/80">
          ขั้น {i + 1}/{sc.steps.length}
        </span>
      </div>
    </div>
  );

  const body = (
    <div className="space-y-3 p-4">
      {d.current.notice && (
        <p className="flex gap-1.5 rounded-lg border border-warning/30 bg-warning-50 px-2.5 py-2 text-xs text-[#7a4705]" role="note">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <b>ใช้ข้อมูลตัวอย่าง: </b>
            {d.current.notice}
          </span>
        </p>
      )}
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1" data-demo="context" aria-label="บริบทที่ส่งต่อ">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-soft" />
          {ids.map(([k, v]) => (
            <span key={k} className="rounded-md bg-bg px-1.5 py-0.5 text-[11px] text-ink-soft">
              {k} <b className="font-mono text-ink">{v}</b>
            </span>
          ))}
        </div>
      )}
      {sc.caseNote && (
        <p className="flex gap-1.5 rounded-lg bg-info-50 px-2.5 py-2 text-xs text-[#1d4ab8]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {sc.caseNote}
        </p>
      )}
      {showAll ? (
        <ol className="space-y-1">
          {sc.steps.map((s, k) => (
            <li key={s.id} className={cn('flex items-start gap-2 rounded-lg p-1.5 text-sm', k === i && 'bg-primary-50')}>
              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold', k < i ? 'bg-success text-white' : k === i ? 'bg-primary text-white' : 'bg-bg text-ink-soft')}>{k + 1}</span>
              <span className="min-w-0">
                <span className="block font-medium text-ink">{s.title}</span>
                <span className="block text-xs text-ink-soft">{ROLE_LABEL[s.role]}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary">มุมมอง: {ROLE_LABEL[step.role]}</span>
          <h3 className="text-base font-bold leading-snug text-ink">
            {i + 1}. {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink">{stepInstruction(step.instruction, d.current)}</p>
          {step.tip && (
            <p className="flex gap-2 rounded-xl bg-warning-50 p-3 text-sm text-[#7a4705]">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>ประเด็นนำเสนอ: </b>
                {step.tip}
              </span>
            </p>
          )}
          {!onRoute && (
            <button onClick={() => returnToStep(nav)} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Undo2 className="h-4 w-4" />
              กลับไปหน้าจอของขั้นนี้
            </button>
          )}
        </>
      )}
      {gate.done && (
        <p className="flex gap-1.5 rounded-lg border border-success/30 bg-success-50 px-2.5 py-2 text-xs text-[#0f5e3a]" role="status">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ขั้นนี้ทำเสร็จแล้ว — กด "ถัดไป" ได้เลย ไม่ต้องทำซ้ำ
        </p>
      )}
      {!gate.ok && (
        <p className="flex gap-1.5 rounded-lg border border-warning/30 bg-warning-50 px-2.5 py-2 text-xs text-[#7a4705]" role="status">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ทำขั้นนี้ให้เสร็จก่อนไปต่อ: {gate.hint}
        </p>
      )}
    </div>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <div className="flex gap-2">
        <button data-demo="back" onClick={() => doBack()} disabled={i === 0} className="flex h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-medium text-ink hover:bg-bg disabled:opacity-40" aria-label="ย้อนกลับ">
          <ChevronLeft className="h-4 w-4" />
          ย้อนกลับ
        </button>
        <button
          data-demo="next"
          onClick={() => doNext()}
          disabled={!gate.ok}
          title={gate.hint}
          className={cn('flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50', isLast ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary-dark')}
        >
          <span className="truncate">{nextLabel}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <button onClick={() => setShowAll(!showAll)} className="font-medium text-ink-soft hover:text-primary">
          {showAll ? 'ซ่อนรายการขั้นตอน' : 'ดูทุกขั้นตอน'}
        </button>
        <button onClick={doRestart} className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-primary">
          <Repeat className="h-3.5 w-3.5" />
          Restart Scenario
        </button>
        {d.journeyMode && (
          <button onClick={doRestartJourney} className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-primary">
            <RotateCcw className="h-3.5 w-3.5" />
            Restart Journey
          </button>
        )}
        <Link to="/demo" className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-primary">
          <LayoutGrid className="h-3.5 w-3.5" />
          Demo Menu
        </Link>
        <button onClick={doPause} className="inline-flex items-center gap-1 font-medium text-ink-soft hover:text-primary">
          <Pause className="h-3.5 w-3.5" />
          Exit Demo
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink-soft">ระบบสาธิต — ข้อมูลจำลอง ผลตรวจสอบและใบรับรองไม่มีผลจริง</p>
    </div>
  );

  return (
    <>
      {/* Desktop: แผงด้านขวา (เนื้อหาแอปเว้นพื้นที่ให้ ไม่บังปุ่ม) */}
      <aside className="fixed bottom-0 right-0 top-7 z-30 hidden w-[360px] flex-col border-l border-line bg-white shadow-pop lg:flex" aria-label="ตัวควบคุมการสาธิต">
        {header}
        <div className="flex-1 overflow-y-auto">{body}</div>
        {footer}
      </aside>

      {/* Mobile/Tablet: แถบล่างแบบย่อ + แผ่นรายละเอียด */}
      <div data-demo="bar" className={cn('fixed inset-x-0 z-30 border-t border-line bg-white shadow-pop lg:hidden', aboveBottomNav ? 'bottom-16' : 'bottom-0')}>
        <div className="flex items-center gap-2 px-3 py-2">
          <button data-demo="back" onClick={() => doBack()} disabled={i === 0} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line disabled:opacity-40" aria-label="ย้อนกลับ">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setSheet(true)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left" aria-label="ดูรายละเอียดขั้นตอน">
            <span className="min-w-0">
              <span className="block truncate text-[11px] text-ink-soft">
                {d.journeyMode ? `Journey ${sc.branch ? code : track === 'v2' ? pos : sc.no}/${seq.length} · ` : ''}S{code} · ขั้น {i + 1}/{sc.steps.length} · {ROLE_LABEL[step.role]}
              </span>
              <span className="block truncate text-sm font-semibold text-ink">{step.title}</span>
              {!gate.ok && <span className="block truncate text-[11px] text-warning">{gate.hint}</span>}
            </span>
            <ChevronUp className="h-4 w-4 shrink-0 text-ink-soft" />
          </button>
          <button
            data-demo="next"
            onClick={() => doNext()}
            disabled={!gate.ok}
            className={cn('flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-medium text-white disabled:opacity-50', isLast ? 'bg-success' : 'bg-primary')}
            aria-label={nextLabel}
          >
            {isLast ? 'สรุป' : 'ถัดไป'}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {sheet && (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={() => setSheet(false)}>
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] animate-slideUp flex-col overflow-hidden rounded-t-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {header}
              <button onClick={() => setSheet(false)} className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10" aria-label="ปิด">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{body}</div>
            {footer}
          </div>
        </div>
      )}

      <RoleTransition
        pending={pending}
        from={role}
        onCancel={() => setPending(undefined)}
        onConfirm={() => (pending?.dir === 'next' ? doNext(true) : doBack(true))}
      />
    </>
  );
}

const ROLE_COLOR: Record<Role, string> = { merchant: 'bg-primary text-white', consumer: 'bg-info text-white', officer: 'bg-secondary text-white', admin: 'bg-ink text-white' };

function RolePill({ role, children }: { role: Role; children?: ReactNode }) {
  return <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', ROLE_COLOR[role])}>{children ?? ROLE_LABEL[role]}</span>;
}

/** Role Transition — อธิบายเหตุผลก่อนเปลี่ยนบทบาท และเปลี่ยนเมื่อผู้ใช้กดยืนยันเท่านั้น */
function RoleTransition({ pending, from, onCancel, onConfirm }: { pending?: Pending; from: Role; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal
      open={!!pending}
      onClose={onCancel}
      title="เปลี่ยนมุมมองการสาธิต"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button onClick={onConfirm} icon={ArrowRight}>
            ดำเนินการต่อในมุม{pending ? ROLE_LABEL[pending.to] : ''}
          </Button>
        </>
      }
    >
      {pending && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <RolePill role={from} />
            <ArrowRight className="h-5 w-5 text-ink-soft" />
            <RolePill role={pending.to} />
          </div>
          <p className="text-center text-[15px] leading-relaxed text-ink">{pending.message}</p>
          <p className="text-center text-xs text-ink-soft">ระบบจะสลับบัญชีสาธิตของบทบาทนี้ และเปิดรายการเดียวกันให้ — การสลับบทบาทเป็นเครื่องมือสาธิตเท่านั้น</p>
        </div>
      )}
    </Modal>
  );
}
