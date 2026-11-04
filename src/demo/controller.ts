/**
 * Demo Controller — ควบคุมขั้นตอนการสาธิตทั้ง 8 Scenario (แบบเดี่ยวและ Full Journey)
 * หลักการ: ไม่เปลี่ยนหน้าด้วย Timer, ไม่เปลี่ยนข้อมูลธุรกิจแทนผู้ใช้ (ยกเว้น Fixture ตอนเริ่ม Scenario),
 * ทุกการเปลี่ยนบทบาทผ่าน Role Transition ที่ผู้ใช้กดยืนยัน
 */
import type { NavigateFunction } from 'react-router-dom';
import type { Role } from '@/types';
import { domainStores, useSessionStore } from '@/stores';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import { useDemoStore, type DemoCtx } from '@/stores/demo';
import { resetAllDemoData } from '@/stores/workflows';
import { STORAGE_PREFIX } from '@/stores/createEntityStore';
import { findScenario, journeyScenarios, trackOf } from '@/mock/scenarios';
import type { ContinuityIssue, DemoStep, GateInput, ScenarioDef, Track } from './types';

export const SNAPSHOT_KEY = `${STORAGE_PREFIX}demo-snapshot`;

// ---------------- Snapshot (ใช้กับ Restart Scenario) ----------------
type Snapshot = { stores: unknown[][]; ai: { ad: unknown; complaint: unknown; replyDrafts: unknown } };

function takeSnapshot() {
  const ai = useAiWorkspaceStore.getState();
  const snap: Snapshot = { stores: domainStores.map((s) => s.getState().items as unknown[]), ai: { ad: ai.ad, complaint: ai.complaint, replyDrafts: ai.replyDrafts } };
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* storage เต็มหรือถูกปิด — Restart จะใช้ Reset + Fixture แทน */
  }
}

function restoreSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw) as Snapshot;
    if (snap.stores.length !== domainStores.length) return false;
    domainStores.forEach((s, i) => (s as unknown as { setState: (p: { items: unknown[] }) => void }).setState({ items: snap.stores[i] }));
    useAiWorkspaceStore.setState(snap.ai as never);
    return true;
  } catch {
    return false;
  }
}

// ---------------- Helpers ----------------
export const activeScenario = () => findScenario(useDemoStore.getState().activeScenario);

export function gateInput(): GateInput {
  const d = useDemoStore.getState();
  const s = useSessionStore.getState();
  return { ctx: d.current, startedAt: d.startedAt ?? '', signals: d.signals, session: { role: s.role, operatorId: s.operatorId, merchantLoggedIn: s.merchantLoggedIn } };
}

export function gateState(step: DemoStep): { ok: boolean; hint?: string; done?: boolean } {
  if (!step.gate) return { ok: true };
  if (step.gate.check(gateInput())) return { ok: true };
  // ย้อนกลับมาขั้นที่ทำสำเร็จแล้ว (เช่น แบบฟอร์มเริ่มใหม่เมื่อเปิดหน้าอีกครั้ง) — ไปต่อได้โดยไม่ต้องทำซ้ำ
  if ((useDemoStore.getState().passed ?? []).includes(step.id)) return { ok: true, done: true };
  return { ok: false, hint: step.gate.hint };
}

/** บริบทที่ส่งต่อได้ รวม ID ของ Scenario ที่กำลังเล่นแต่ยังไม่จบ (เช่น ร้านที่สมัครแล้วใน Scenario 2) */
function effectiveJourney(exceptId?: string): DemoCtx {
  const d = useDemoStore.getState();
  const sc = findScenario(d.activeScenario);
  if (!sc || sc.id === exceptId || d.status === 'completed' || !sc.exports) return d.journey;
  return { ...d.journey, ...sc.exports(d.current) };
}

/** ตั้งค่าบัญชีของบทบาทตามบริบท (เช่น Merchant ID เดิม) — ใช้ตอนสลับบทบาทเท่านั้น */
function applyAccount(role: Role, ctx: DemoCtx) {
  const s = useSessionStore.getState();
  if (role === 'merchant') s.set({ role, operatorId: ctx.operatorId ?? '', merchantLoggedIn: !!ctx.operatorId, activeMerchantId: ctx.merchantId });
  if (role === 'consumer') s.set({ role, consumerId: ctx.consumerId ?? 'CS-001' });
  if (role === 'officer') s.set({ role, officerId: ctx.officerId ?? 'OF-001' });
  if (role === 'admin') s.set({ role, officerId: 'AD-001' });
}

export const stepRoute = (step: DemoStep, ctx = useDemoStore.getState().current) => step.route(ctx);

/** เข้าสู่ขั้นตอน: สลับบัญชีเมื่อเปลี่ยนบทบาท และเปิดหน้าจอเฉพาะเมื่อปลายทางต่างจากหน้าปัจจุบัน */
function enterStep(sc: ScenarioDef, index: number, nav: NavigateFunction, currentPath: string | undefined, forceAccount = false) {
  const d = useDemoStore.getState();
  const step = sc.steps[index];
  d.set({ stepIndex: index });
  if (forceAccount || useSessionStore.getState().role !== step.role) applyAccount(step.role, d.current);
  const target = stepRoute(step);
  if (target !== currentPath) nav(target);
}

/** ต้องแสดง Role Transition หรือไม่ เมื่อจะไปขั้นที่ index */
export function needsTransition(index: number): boolean {
  const sc = activeScenario();
  if (!sc || !sc.steps[index]) return false;
  return sc.steps[index].role !== useSessionStore.getState().role;
}

// ---------------- Scenario lifecycle ----------------
/** ตรวจก่อน prepare ว่าต้องใช้ข้อมูลตัวอย่างแทนหรือไม่ แล้วบันทึกคำอธิบายไว้ในบริบท (ไม่สลับข้อมูลแบบเงียบ) */
function prepareWithNotice(sc: ScenarioDef, journey: DemoCtx, carry: boolean): DemoCtx {
  const issue = carry ? sc.continuity?.(journey) : undefined;
  const ctx = sc.prepare(journey, carry);
  return issue ? { ...ctx, notice: `${issue.message} จึงใช้${issue.fallbackLabel}แทน` } : ctx;
}

/** ข้อมูลที่ส่งต่อมาให้ Scenario นี้ใช้ได้หรือไม่ (ใช้ก่อน "ดำเนินการต่อ" / "ข้ามไป") */
export function continuityIssue(id: string): ContinuityIssue | undefined {
  return findScenario(id)?.continuity?.(effectiveJourney(id));
}

/** ย้อนกลับไปทำ Scenario ที่ยังไม่ครบ — ถ้ากำลังค้างอยู่ให้สาธิตต่อจากขั้นเดิม */
export function goFixScenario(id: string, nav: NavigateFunction) {
  if (scenarioStatus(id) === 'current') resumeDemo(nav);
  else startScenario(id, nav, { carry: true, journey: true });
}

/**
 * เริ่ม Scenario
 * - แบบเดี่ยว (carry=false): Reset ข้อมูลทั้งหมด แล้วใช้ Fixture ของเรื่อง
 * - ต่อเนื่อง (carry=true): ไม่ Reset — ใช้ IDs จาก Scenario ก่อนหน้า (หรือ Fixture เมื่อจำเป็น)
 */
export function startScenario(id: string, nav: NavigateFunction, opts: { carry?: boolean; journey?: boolean } = {}) {
  const sc = findScenario(id);
  if (!sc) return;
  const carry = !!opts.carry;
  const prev = useDemoStore.getState();
  const journeyMode = opts.journey ?? (carry ? prev.journeyMode : false);
  // เส้นทางทางเลือกเล่นระหว่าง Journey ได้โดยไม่เปลี่ยนชุดของ Journey
  const journeyTrack = journeyMode && sc.branch ? prev.journeyTrack : trackOf(sc);
  const journey = carry ? effectiveJourney(id) : {};
  const completed = carry ? prev.completed : [];
  const results = carry ? prev.results : {};
  if (!carry) resetAllDemoData();
  const current = prepareWithNotice(sc, journey, carry);
  takeSnapshot();
  useDemoStore.getState().set({
    activeScenario: sc.id,
    stepIndex: 0,
    status: 'running',
    journeyMode,
    journeyTrack,
    journey,
    completed,
    results,
    current,
    startCtx: current,
    startedAt: new Date().toISOString(),
    signals: {},
    passed: [],
    panelOpen: true,
  });
  enterStep(sc, 0, nav, undefined, true);
}

/** Restart Scenario — คืนข้อมูลเป็นจุดเริ่มต้นของเรื่อง (ไม่สร้างข้อมูลซ้ำ และไม่กระทบผลของ Scenario ก่อนหน้า) */
export function restartScenario(nav: NavigateFunction) {
  const d = useDemoStore.getState();
  const sc = activeScenario() ?? findScenario(d.activeScenario);
  if (!sc) return;
  if (restoreSnapshot()) {
    // ข้อมูลกลับเป็นจุดเริ่มต้นแล้ว — ใช้บริบทตอนเริ่มเดิม (Fixture บางชุดสร้างรายการใหม่ทุกครั้งที่เรียก)
    const current = d.startCtx ?? prepareWithNotice(sc, d.journey, true);
    d.set({ current, stepIndex: 0, status: 'running', startedAt: new Date().toISOString(), signals: {}, passed: [] });
    enterStep(sc, 0, nav, undefined, true);
  } else {
    startScenario(sc.id, nav, { carry: false });
  }
}

export type MoveResult = 'moved' | 'transition' | 'blocked' | 'completed';

/** ไปขั้นถัดไป — confirmed=true เมื่อผู้ใช้กดยืนยันใน Role Transition แล้ว */
export function next(nav: NavigateFunction, currentPath: string, confirmed = false): MoveResult {
  const sc = activeScenario();
  if (!sc) return 'blocked';
  const d = useDemoStore.getState();
  const step = sc.steps[d.stepIndex];
  if (!gateState(step).ok) return 'blocked';
  if (step.gate && !d.passed?.includes(step.id)) d.set({ passed: [...(d.passed ?? []), step.id] });
  if (step.capture) d.set({ current: { ...d.current, ...step.capture(gateInput()) } });
  if (d.stepIndex >= sc.steps.length - 1) {
    completeScenario(nav);
    return 'completed';
  }
  if (!confirmed && needsTransition(d.stepIndex + 1)) return 'transition';
  enterStep(sc, d.stepIndex + 1, nav, currentPath);
  return 'moved';
}

export function back(nav: NavigateFunction, currentPath: string, confirmed = false): MoveResult {
  const sc = activeScenario();
  const d = useDemoStore.getState();
  if (!sc || d.stepIndex === 0) return 'blocked';
  if (!confirmed && needsTransition(d.stepIndex - 1)) return 'transition';
  enterStep(sc, d.stepIndex - 1, nav, currentPath);
  return 'moved';
}

/** กลับไปหน้าจอของขั้นปัจจุบัน (เมื่อผู้ใช้เปิดหน้าอื่นระหว่างสาธิต) */
export function returnToStep(nav: NavigateFunction) {
  const sc = activeScenario();
  if (!sc) return;
  enterStep(sc, useDemoStore.getState().stepIndex, nav, undefined, true);
}

export function completeScenario(nav: NavigateFunction) {
  const sc = activeScenario();
  if (!sc) return;
  const d = useDemoStore.getState();
  d.set({
    status: 'completed',
    completed: d.completed.includes(sc.id) ? d.completed : [...d.completed, sc.id],
    journey: { ...d.journey, ...(sc.exports?.(d.current) ?? {}) },
    results: { ...d.results, [sc.id]: d.current },
  });
  nav(`/demo/complete/${sc.id}`);
}

/** Scenario ถัดไป/ก่อนหน้าในลำดับของชุดเดียวกัน — เส้นทางทางเลือกไม่มีลำดับต่อ */
function neighbour(id: string, delta: 1 | -1) {
  const sc = findScenario(id);
  if (!sc || sc.branch) return undefined;
  const seq = journeyScenarios(trackOf(sc));
  return seq[seq.findIndex((s) => s.id === id) + delta]?.id;
}
export const nextScenarioId = (id: string) => neighbour(id, 1);
export const prevScenarioId = (id: string) => neighbour(id, -1);

/** Scenario แรกของ Journey ที่ยังไม่จบ (ใช้กลับเข้าสู่ Journey หลังเล่นเส้นทางทางเลือก) */
export function nextUnfinished(track: Track) {
  const done = useDemoStore.getState().completed;
  return journeyScenarios(track).find((s) => !done.includes(s.id))?.id;
}

/** ดำเนินการต่อ Scenario ถัดไปโดยใช้ข้อมูลที่สร้างไว้ (ไม่ Reset) */
export function continueToNext(fromId: string, nav: NavigateFunction) {
  const nextId = nextScenarioId(fromId);
  if (!nextId) return nav('/demo/overview');
  startScenario(nextId, nav, { carry: true });
}

// ---------------- Full Journey ----------------
export function startJourney(nav: NavigateFunction, track: Track = 'v1') {
  resetAllDemoData();
  useDemoStore.getState().set({ journeyMode: true, journeyTrack: track, completed: [], journey: {}, results: {} });
  startScenario(journeyScenarios(track)[0].id, nav, { carry: true, journey: true });
}

/** เริ่ม Full Journey ชุดเดิมใหม่ทั้งหมด */
export const restartJourney = (nav: NavigateFunction) => startJourney(nav, useDemoStore.getState().journeyTrack ?? 'v1');

/** สถานะของแต่ละ Scenario ในภาพรวม */
export function scenarioStatus(id: string): 'completed' | 'current' | 'not_started' {
  const d = useDemoStore.getState();
  if (d.activeScenario === id && d.status !== 'completed') return 'current';
  if (d.completed.includes(id)) return 'completed';
  return 'not_started';
}

/** หยุดชั่วคราว — ซ่อนแผงควบคุม เก็บข้อมูลและขั้นตอนไว้ */
export function pauseDemo() {
  useDemoStore.getState().set({ status: 'paused' });
}

export function resumeDemo(nav: NavigateFunction) {
  const sc = activeScenario();
  if (!sc) return;
  useDemoStore.getState().set({ status: 'running' });
  enterStep(sc, useDemoStore.getState().stepIndex, nav, undefined, true);
}

/** ออกจากการสาธิต — ข้อมูลที่สร้างไว้ยังอยู่ (ไม่ Reset) */
export function exitDemo() {
  useDemoStore.getState().set({ activeScenario: undefined, status: 'idle', journeyMode: false });
}

/** Reset Scenario จากหน้ารวม — คืนข้อมูลเป็นจุดเริ่มต้นของเรื่อง (แบบเดี่ยว) โดยยังไม่เริ่มสาธิต */
export function resetScenarioData(id: string) {
  const sc = findScenario(id);
  if (!sc) return;
  resetAllDemoData();
  sc.prepare({}, false);
}
