/**
 * Test harness — รัน Store/Workflow จริงใน Node และ Render หน้าจอ (SSR) ตามบทบาท
 * ไม่มี Backend: ใช้ localStorage จำลองในหน่วยความจำ
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const storage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => storage[k] ?? null,
  setItem: (k: string, v: string) => (storage[k] = String(v)),
  removeItem: (k: string) => delete storage[k],
  clear: () => Object.keys(storage).forEach((k) => delete storage[k]),
};
(globalThis as any).window = globalThis;
(globalThis as any).location = { origin: 'http://localhost:5173' };

const req = createRequire(new URL('../package.json', import.meta.url));
const imp = (id: string) => import(pathToFileURL(req.resolve(id)).href);

// zustand อ่าน initial state ตอน SSR — ให้ server snapshot อ่าน state ปัจจุบันแทน (ต้องทำก่อนโหลดแอป)
const React = await imp('react');
const R = (React.default ?? React) as any;
const origUSES = R.useSyncExternalStore;
R.useSyncExternalStore = (sub: unknown, get: unknown) => origUSES(sub, get, get);

const { renderToString } = await imp('react-dom/server');
const { StaticRouter } = await imp('react-router-dom/server');
const { AppRoutes } = await import('@/routes/AppRoutes');
export const S = await import('@/stores');
export const W = await import('@/stores/workflows');
export const T = await import('@/utils/trust');
export const ST = await import('@/utils/stats');
export const MOCK = await import('@/mock/data');

type Session = Record<string, unknown> & { role: 'merchant' | 'consumer' | 'officer' | 'admin' };

/** Render เส้นทางในบทบาทที่กำหนด แล้วคืนข้อความที่ผู้ใช้เห็น (ตัดแท็ก HTML) */
export function view(url: string, session?: Session): string {
  const keep = S.useSessionStore.getState();
  if (session) S.useSessionStore.setState({ merchantLoggedIn: true, ...session });
  const silenced = console.error;
  console.error = () => {};
  try {
    const html = renderToString(R.createElement(StaticRouter, { location: url }, R.createElement(AppRoutes)));
    return html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  } finally {
    console.error = silenced;
    if (session) S.useSessionStore.setState({ role: keep.role, operatorId: keep.operatorId, consumerId: keep.consumerId, officerId: keep.officerId, merchantLoggedIn: keep.merchantLoggedIn });
  }
}

// ---------- assertions ----------
let failures = 0;
let passes = 0;
let section = '';
export function describe(name: string) {
  section = name;
  console.log(`\n▶ ${name}`);
}
export function check(cond: unknown, msg: string) {
  if (cond) {
    passes++;
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.log(`  ✗ ${msg}   [${section}]`);
  }
}
export function finish() {
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

// ---------- helpers ----------
export const merchant = (id: string) => S.useMerchantStore.getState().items.find((m) => m.id === id)!;
export const operator = (id: string) => S.useOperatorStore.getState().items.find((o) => o.id === id)!;
export const cert = (merchantId: string) => T.currentCert(S.useCertificationStore.getState().items, merchantId);
export const verdict = (merchantId: string) => {
  const m = merchant(merchantId);
  return T.verdictFor(m, operator(m.operatorId), cert(merchantId));
};
export const complaint = (id: string) => S.useComplaintStore.getState().items.find((c) => c.id === id)!;
export const notesFor = (role: string, id?: string) =>
  S.useNotificationStore.getState().items.filter((n) => n.recipientRole === role && (!n.recipientId || n.recipientId === id));
export const stats = () =>
  ST.computeStats(
    {
      operators: S.useOperatorStore.getState().items,
      merchants: S.useMerchantStore.getState().items,
      apps: S.useVerificationStore.getState().items,
      certs: S.useCertificationStore.getState().items,
      complaints: S.useComplaintStore.getState().items,
      warnings: S.useWarningStore.getState().items,
      enrollments: S.useTrainingStore.getState().items,
    },
    { province: '', months: 0 },
  );
