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
 * - เบราว์เซอร์ยกเลิกการโหลดเพราะกำลังเปลี่ยน/Reload หน้า (เช่น Firefox) → ระหว่างรอ หน้าเดิมถูกปิดไปแล้ว จึงไม่แสดง Error ที่ไม่มีอยู่จริง
 * - ลองครบแล้วยังไม่สำเร็จ → ส่ง Error เดิมต่อให้ ErrorBoundary (ไม่ซ่อนปัญหา)
 */
export function withRetry<T>(load: () => Promise<T>, delays: number[] = RETRY_DELAYS_MS, wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))): Promise<T> {
  return load().catch(async (err) => {
    if (!delays.length) throw err;
    await wait(delays[0]);
    return withRetry(load, delays.slice(1), wait);
  });
}

export function lazyPage(load: Loader): LazyPage {
  let Loaded: LazyPage | ComponentType<object> | undefined;
  // ใช้การโหลดร่วมกันระหว่าง preload และ React.lazy · ล้มเหลวแล้วเริ่มใหม่ได้ในครั้งถัดไป
  let pending: ReturnType<Loader> | undefined;
  const loadOnce = () =>
    (pending ??= withRetry(load).then(
      (m) => ((Loaded = m.default), m),
      (err) => {
        pending = undefined;
        throw err;
      },
    ));
  const preload = () => loadOnce().then(() => undefined);
  const Lazy = lazy(loadOnce);
  const Page = ((props: object) => (Loaded ? <Loaded {...props} /> : <Lazy {...props} />)) as LazyPage;
  Page.preload = preload;
  registry.push(preload);
  return Page;
}

/** โหลดทุกหน้าล่วงหน้า (ใช้ใน Test และหลังหน้าแรกแสดงผลแล้ว) */
export const preloadAllPages = () => Promise.all(registry.map((p) => p())).then(() => undefined);

/** โหลดหน้าที่เหลือตอนเบราว์เซอร์ว่าง — การสาธิตเปลี่ยนหน้าได้ทันทีโดยไม่เพิ่มขนาดไฟล์แรก */
export function preloadWhenIdle(delayMs = 1500) {
  if (typeof window === 'undefined') return;
  const run = () => void preloadAllPages().catch(() => undefined);
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  window.setTimeout(() => (idle ? idle(run) : run()), delayMs);
}
