/**
 * Demo Controller — ควบคุมขั้นตอนการสาธิต (Demo หลัก · กรณีพิเศษ · ฟังก์ชันอื่น — เล่นทีละเรื่อง)
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
import { findScenario } from '@/mock/scenarios';
import { ROUTER_BASENAME } from '@/utils/appUrl';
import type { DemoStep, GateInput, ScenarioDef, GateBlock } from './types';

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

export function gateState(step: DemoStep): { ok: boolean; hint?: string; done?: boolean; blocked?: GateBlock } {
  if (!step.gate) return { ok: true };
  if (step.gate.check(gateInput())) return { ok: true };
  // ย้อนกลับมาขั้นที่ทำสำเร็จแล้ว (เช่น แบบฟอร์มเริ่มใหม่เมื่อเปิดหน้าอีกครั้ง) — ไปต่อได้โดยไม่ต้องทำซ้ำ
  if ((useDemoStore.getState().passed ?? []).includes(step.id)) return { ok: true, done: true };
  return { ok: false, hint: step.gate.hint, blocked: step.gate.blocked?.(gateInput()) };
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

/**
 * เส้นทางปัจจุบันจริงของเบราว์เซอร์ (ตัด base path ออก)
 * Router เปิด v7_startTransition — การเปลี่ยนหน้าถูก Render แบบ Transition ภายหลัง ขณะที่ Demo Store อัปเดตทันที
 * ค่า location จาก React จึงอาจยังเป็นหน้าก่อนหน้า (เมื่อกดถัดไป/ย้อนกลับติดกันเร็ว ๆ หรือเครื่องทำงานหนัก)
 * ถ้าเทียบกับค่าเก่าจะ "ข้ามการเปลี่ยนหน้า" ผิด → ขั้นเปลี่ยนแต่หน้าจอไม่เปลี่ยน — ใช้ค่าจริงจาก history แทน
 */
export function livePath(fallback?: string): string | undefined {
  const l = typeof window !== 'undefined' ? (window.location as Location | undefined) : undefined;
  if (!l || typeof l.pathname !== 'string') return fallback;
  const p = ROUTER_BASENAME && l.pathname.startsWith(ROUTER_BASENAME) ? l.pathname.slice(ROUTER_BASENAME.length) || '/' : l.pathname;
  return p + (l.search ?? '');
}

/** เข้าสู่ขั้นตอน: สลับบัญชีเมื่อเปลี่ยนบทบาท และเปิดหน้าจอเฉพาะเมื่อปลายทางต่างจากหน้าปัจจุบัน */
function enterStep(sc: ScenarioDef, index: number, nav: NavigateFunction, currentPath: string | undefined, forceAccount = false) {
  const d = useDemoStore.getState();
  const step = sc.steps[index];
  d.set({ stepIndex: index });
  if (forceAccount || useSessionStore.getState().role !== step.role) applyAccount(step.role, d.current);
  const target = stepRoute(step);
  if (target !== livePath(currentPath)) nav(target);
}

/** ต้องแสดง Role Transition หรือไม่ เมื่อจะไปขั้นที่ index */
export function needsTransition(index: number): boolean {
  const sc = activeScenario();
  if (!sc || !sc.steps[index]) return false;
  return sc.steps[index].role !== useSessionStore.getState().role;
}

// ---------------- Scenario lifecycle ----------------
/**
 * เริ่มการสาธิต — Reset ข้อมูลสาธิตทั้งหมด แล้วเตรียมข้อมูลจุดเริ่มต้นของเรื่องนั้น (ไม่มีการส่งต่อข้อมูลข้ามเรื่อง)
 */
export function startScenario(id: string, nav: NavigateFunction) {
  const sc = findScenario(id);
  if (!sc) return;
  const prev = useDemoStore.getState();
  resetAllDemoData();
  const current = sc.prepare({}, false);
  takeSnapshot();
  useDemoStore.getState().set({
    activeScenario: sc.id,
    stepIndex: 0,
    status: 'running',
    completed: prev.completed,
    results: prev.results,
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
    const current = d.startCtx ?? sc.prepare({}, false);
    d.set({ current, stepIndex: 0, status: 'running', startedAt: new Date().toISOString(), signals: {}, passed: [] });
    enterStep(sc, 0, nav, undefined, true);
  } else {
    startScenario(sc.id, nav);
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
    results: { ...d.results, [sc.id]: d.current },
  });
  nav(`/demo/complete/${sc.id}`);
}

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
  useDemoStore.getState().set({ activeScenario: undefined, status: 'idle' });
}

/** Reset Scenario จากหน้ารวม — คืนข้อมูลเป็นจุดเริ่มต้นของเรื่อง (แบบเดี่ยว) โดยยังไม่เริ่มสาธิต */
export function resetScenarioData(id: string) {
  const sc = findScenario(id);
  if (!sc) return;
  resetAllDemoData();
  sc.prepare({}, false);
}
