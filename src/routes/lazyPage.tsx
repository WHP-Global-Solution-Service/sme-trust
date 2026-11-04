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
export function lazyPage(load: Loader): LazyPage {
  let Loaded: LazyPage | ComponentType<object> | undefined;
  const preload = () =>
    load().then((m) => {
      Loaded = m.default;
    });
  const Lazy = lazy(() => load().then((m) => ((Loaded = m.default), m)));
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
