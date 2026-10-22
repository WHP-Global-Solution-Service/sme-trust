// Render every route (SSR) per role to catch render-time crashes and permission gating issues
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => (mem[k] = v), removeItem: (k: string) => delete mem[k] };
(globalThis as any).window = globalThis;
(globalThis as any).location = { origin: 'http://localhost:5173' };


const { createRequire } = await import('node:module');
const { pathToFileURL } = await import('node:url');
const req = createRequire(new URL('../package.json', import.meta.url));
const imp = (id: string) => import(pathToFileURL(req.resolve(id)).href);
const React = await imp('react');
// ให้ server snapshot อ่าน state ปัจจุบัน (zustand ใช้ initial state ตอน SSR)
const R = (React.default ?? React) as any;
const origUSES = R.useSyncExternalStore;
R.useSyncExternalStore = (sub: any, get: any) => origUSES(sub, get, get);
const { renderToString } = await imp('react-dom/server');
const { StaticRouter } = await imp('react-router-dom/server');
const { AppRoutes } = await import('@/routes/AppRoutes');
const S = await import('@/stores');
// SSR ใช้ getServerState — ชี้ไปที่ state ปัจจุบันเพื่อให้ทดสอบแต่ละบทบาทได้
for (const st of [S.useSessionStore, ...S.domainStores] as any[]) st.getServerState = () => st.getState();

const origErr = console.error;
const errors: string[] = [];
console.error = (...a: any[]) => {
  const s = a.map(String).join(' ');
  if (s.includes('width(0) and height(0)') || s.includes('useLayoutEffect')) return; // Recharts SSR noise
  errors.push(s.slice(0, 300));
};

const routes: [string, string, Record<string, unknown>][] = [
  ['/', 'consumer', {}], ['/register', 'consumer', {}], ['/login', 'merchant', { operatorId: 'OP-001' }], ['/login', 'merchant', { operatorId: '' }],
  ['/m', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m', 'merchant', { operatorId: 'OP-011', merchantLoggedIn: true }],
  ['/m/kyc', 'merchant', { operatorId: 'OP-011', merchantLoggedIn: true }],
  ['/m/shop', 'merchant', { operatorId: 'OP-010', merchantLoggedIn: true }],
  ['/m/shop', 'merchant', { operatorId: 'OP-008', merchantLoggedIn: true }],
  ['/m/register-shop', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m/certification', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m/certification', 'merchant', { operatorId: 'OP-004', merchantLoggedIn: true }],
  ['/m/certification', 'merchant', { operatorId: 'OP-007', merchantLoggedIn: true }],
  ['/m/passport', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m/complaints', 'merchant', { operatorId: 'OP-004', merchantLoggedIn: true }],
  ['/m/complaints/CMP-2569-0002', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m/complaints/CMP-2569-0002', 'merchant', { operatorId: 'OP-004', merchantLoggedIn: true }],
  ['/m/warnings', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/warnings/WRN-2569-0001', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/review', 'merchant', { operatorId: 'OP-004', merchantLoggedIn: true }],
  ['/m/review', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m/training', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/training/CRS-02', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/toolkit', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/m/toolkit', 'merchant', { operatorId: 'OP-004', merchantLoggedIn: true }],
  ['/m/notifications', 'merchant', { operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/check', 'consumer', {}], ['/check?q=ผ้า', 'consumer', {}], ['/directory', 'consumer', {}],
  ['/shop/M-001', 'consumer', {}], ['/shop/M-999', 'consumer', {}], ['/verify', 'consumer', {}],
  ['/verify/SMT-2569-000101', 'consumer', {}], ['/verify/SMT-2569-000098', 'consumer', {}], ['/verify/SMT-0000-999999', 'consumer', {}],
  ['/report', 'consumer', {}], ['/report?merchant=M-001', 'consumer', {}], ['/consumer/cases', 'consumer', { consumerId: 'CS-002' }],
  ['/consumer/cases/CMP-2569-0002', 'consumer', { consumerId: 'CS-002' }], ['/consumer/cases/CMP-2569-0002', 'consumer', { consumerId: 'CS-001' }],
  ['/consumer/notifications', 'consumer', {}],
  ['/o', 'officer', {}], ['/o/applications', 'officer', {}], ['/o/applications/APP-2569-0006', 'officer', {}], ['/o/applications/APP-2569-0007', 'officer', {}],
  ['/o/verification', 'officer', {}], ['/o/certification', 'officer', {}], ['/o/complaints', 'officer', {}], ['/o/complaints/CMP-2569-0015', 'officer', {}],
  ['/o/warnings', 'officer', {}], ['/o/warnings/new', 'officer', {}], ['/o/warnings/WRN-2569-0006', 'officer', {}], ['/o/corrective', 'officer', {}],
  ['/o/risk', 'officer', {}], ['/o/risk/RSK-2569-0004', 'officer', {}], ['/o/risk/RSK-2569-0001', 'officer', {}], ['/o/training', 'officer', {}], ['/o/reports', 'officer', {}],
  ['/o/notifications', 'officer', {}],
  ['/admin', 'admin', { officerId: 'AD-001' }], ['/admin/accounts', 'admin', { officerId: 'AD-001' }], ['/admin/audit', 'admin', { officerId: 'AD-001' }], ['/admin/data', 'admin', { officerId: 'AD-001' }],
  ['/o', 'admin', { officerId: 'AD-001' }],
  // expected denials
  ['/admin', 'officer', { __deny: true }], ['/o', 'consumer', { __deny: true }], ['/report', 'merchant', { __deny: true, operatorId: 'OP-001', merchantLoggedIn: true }],
  ['/preview?device=tablet&path=%2Fcheck', 'consumer', {}],
  ['/demo', 'consumer', {}], ['/demo', 'officer', {}], ['/demo/complete/s1', 'consumer', {}], ['/demo/overview', 'consumer', {}],
  ['/m/ai', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }], ['/m/ai/ad-checker', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/m/ai/complaint?case=CMP-2569-0005', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }], ['/m/ai/history', 'merchant', { operatorId: 'OP-003', merchantLoggedIn: true }],
  ['/nope', 'consumer', {}], ['/404', 'consumer', {}],
];

let fail = 0;
for (const [url, role, extra] of routes) {
  const { __deny, ...sess } = extra as any;
  S.useSessionStore.setState({ role, ...sess });
  errors.length = 0;
  try {
    const html = renderToString(React.createElement(StaticRouter, { location: url }, React.createElement(AppRoutes)));
    const denied = html.includes('Permission Denied');
    const bad = (!!__deny !== denied) || errors.length > 0;
    if (bad) fail++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${role.padEnd(8)} ${url.padEnd(36)} ${html.length}b${denied ? ' [denied]' : ''}${errors.length ? ' ERR: ' + errors.join(' | ') : ''}`);
  } catch (e: any) {
    fail++;
    console.log(`FAIL ${role.padEnd(8)} ${url.padEnd(36)} THROW ${e?.message}\n${String(e?.stack).split('\n').slice(1, 4).join('\n')}`);
  }
}
console.error = origErr;
console.log(fail ? `\n${fail} FAILURES` : `\nALL ${routes.length} ROUTES OK`);
process.exit(fail ? 1 : 0);
