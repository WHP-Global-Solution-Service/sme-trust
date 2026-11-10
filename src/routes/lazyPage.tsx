import { lazy, type ComponentType } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loader = () => Promise<{ default: ComponentType<any> }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LazyPage = ComponentType<any> & { preload: () => Promise<void> };

const registry: (() => Promise<void>)[] = [];

/**
 * หน้าแบบโหลดเมื่อใช้ (Route-based Code Splitting)
 * - ครั้งแรกโหลดผ่าน React.lazy (มี Suspense fallback)
 * - เมื่อ preload แล้วจะ Render แบบ Synchronous — ใช้กับ SSR Test และการโหลดล่วงหน้าตอนเครื่องว่าง
 */
/** หน่วงก่อนลองโหลดไฟล์หน้าอีกครั้ง (มิลลิวินาที) — ครั้งที่ 1 และ 2 */
export const RETRY_DELAYS_MS = [500, 1500];

/**
 * โหลดไฟล์ของหน้าแบบลองซ้ำเมื่อไม่สำเร็จ
 * - เครือข่ายสะดุดชั่วคราว → ลองใหม่ก่อนแสดงหน้าข้อผิดพลาด
 * - ลองครบแล้วยังไม่สำเร็จ → ส่ง Error เดิมต่อให้ ErrorBoundary (ไม่ซ่อนปัญหา)
 */
export function withRetry<T>(load: () => Promise<T>, delays: number[] = RETRY_DELAYS_MS, wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<T> {
  return load().catch(async (err) => {
    if (!delays.length) throw err;
    await wait(delays[0]);
    return withRetry(load, delays.slice(1), wait);
  });
}

// ---------------- เอกสารกำลังถูกปิด (KI-V2-37) ----------------
/**
 * เมื่อเปิดหน้าใหม่ทั้งหน้า / Reload เบราว์เซอร์ยกเลิกการโหลดไฟล์ของเอกสารเดิม (Firefox: NS_BINDING_ABORTED)
 * ถ้าเอกสารเดิมยังทำงานจนลองซ้ำครบ จะแสดงหน้าข้อผิดพลาดของเอกสารที่ผู้ใช้กำลังออกไปแล้ว
 * ระหว่างนี้จึงรอแทนการส่ง Error — ถ้าเอกสารไม่ถูกปิดจริง (การออกจากหน้าถูกยกเลิก) จะโหลดใหม่ตามปกติ
 */
export const LEAVE_GRACE_MS = 5000;
let leaving = false;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
let stayedWaiters: (() => void)[] = [];

export function markLeaving() {
  leaving = true;
  if (leaveTimer) clearTimeout(leaveTimer);
  leaveTimer = setTimeout(markStayed, LEAVE_GRACE_MS);
}
export function markStayed() {
  leaving = false;
  if (leaveTimer) clearTimeout(leaveTimer);
  leaveTimer = undefined;
  const w = stayedWaiters;
  stayedWaiters = [];
  w.forEach((f) => f());
}
export const isLeaving = () => leaving;
const untilStayed = () => new Promise<void>((r) => stayedWaiters.push(r));

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', markLeaving);
  window.addEventListener('pagehide', markLeaving);
  window.addEventListener('pageshow', markStayed);
}

/** Error จากการโหลดไฟล์ของหน้า (ไม่ใช่ Error ระหว่าง Render) — ErrorBoundary ใช้แสดงข้อความที่ตรงสาเหตุ */
export const PAGE_LOAD_ERROR = Symbol.for('smetrust.pageLoadError');
export const isPageLoadError = (err: unknown) => !!err && typeof err === 'object' && (err as Record<symbol, unknown>)[PAGE_LOAD_ERROR] === true;
function tagPageLoad(err: unknown) {
  if (err && typeof err === 'object') {
    try {
      (err as Record<symbol, unknown>)[PAGE_LOAD_ERROR] = true;
    } catch {
      /* Error ที่แก้ไม่ได้ — แสดงเป็น Error ทั่วไป */
    }
  }
  return err;
}

/** โหลดแบบลองซ้ำ · ล้มเหลวระหว่างที่เอกสารกำลังถูกปิด → รอ ไม่ส่ง Error */
export function loadPage<T>(load: () => Promise<T>, delays: number[] = RETRY_DELAYS_MS, wait?: (ms: number) => Promise<void>): Promise<T> {
  return withRetry(load, delays, wait).catch((err) => {
    if (!leaving) throw tagPageLoad(err);
    return untilStayed().then(() => loadPage(load, delays, wait));
  });
}

// ---------------- หน้าที่ผู้ใช้กำลังเปิดมาก่อนการโหลดล่วงหน้า ----------------
let userLoads = 0;
let idleWaiters: (() => void)[] = [];
/** ระหว่างที่หน้าซึ่งผู้ใช้เปิดยังโหลดไม่เสร็จ การโหลดล่วงหน้าหยุดรอ */
export function trackUserLoad<T>(p: Promise<T>): Promise<T> {
  userLoads++;
  const done = () => {
    userLoads--;
    if (userLoads === 0) {
      const w = idleWaiters;
      idleWaiters = [];
      w.forEach((f) => f());
    }
  };
  p.then(done, done);
  return p;
}
export const userLoadsInFlight = () => userLoads;
const untilNoUserLoads = () => (userLoads === 0 ? Promise.resolve() : new Promise<void>((r) => idleWaiters.push(r)));

export function lazyPage(load: Loader): LazyPage {
  let Loaded: LazyPage | ComponentType<object> | undefined;
  // ใช้การโหลดร่วมกันระหว่าง preload และ React.lazy · ล้มเหลวแล้วเริ่มใหม่ได้ในครั้งถัดไป
  let pending: ReturnType<Loader> | undefined;
  const loadOnce = () =>
    (pending ??= loadPage(load).then(
      (m) => ((Loaded = m.default), m),
      (err) => {
        pending = undefined;
        throw err;
      },
    ));
  const preload = () => loadOnce().then(() => undefined);
  const Lazy = lazy(() => trackUserLoad(loadOnce()));
  const Page = ((props: object) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />)) as LazyPage;
  Page.preload = preload;
  registry.push(preload);
  return Page;
}

/** โหลดทุกหน้าพร้อมกัน (ใช้ใน Test ฝั่ง Node) */
export const preloadAllPages = () => Promise.all(registry.map((p) => p())).then(() => undefined);

/**
 * โหลดทีละหน้า (KI-V2-38) — เดิมขอทุกไฟล์พร้อมกันราว 140 ไฟล์ ไฟล์ของหน้าที่ผู้ใช้กำลังเปิดต้องต่อคิวหลังไฟล์ล่วงหน้า
 * (เบราว์เซอร์จำกัดการเชื่อมต่อต่อเซิร์ฟเวอร์) เมื่อเครื่อง/เครือข่ายช้า หน้าจอค้างที่ "กำลังโหลดหน้า..." นานเกิน 15 วินาที
 * ทีละหน้า → การเปลี่ยนหน้าของผู้ใช้ได้การเชื่อมต่อทันที · หน้าที่ผู้ใช้เปิดอยู่ยังโหลดไม่เสร็จ → รอก่อน · หยุดเมื่อเอกสารกำลังถูกปิด
 */
export async function preloadSequentially(tasks: (() => Promise<void>)[] = registry) {
  for (const t of tasks) {
    await untilNoUserLoads();
    if (leaving) return;
    await t().catch(() => undefined);
  }
}

/** โหลดหน้าที่เหลือตอนเบราว์เซอร์ว่าง — การสาธิตเปลี่ยนหน้าได้ทันทีโดยไม่เพิ่มขนาดไฟล์แรก */
export function preloadWhenIdle(delayMs = 1500) {
  if (typeof window === 'undefined') return;
  const run = () => void preloadSequentially();
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  window.setTimeout(() => (idle ? idle(run) : run()), delayMs);
}
