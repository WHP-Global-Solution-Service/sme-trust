/**
 * Base path ของแอป (รองรับ GitHub Pages ที่อยู่ใต้ /<repo>/)
 * ค่าเริ่มต้น "/" — กำหนดตอน build ด้วย VITE_BASE เช่น VITE_BASE=/sme-trust/
 */
const RAW_BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** base ที่ไม่มี "/" ท้าย — ใช้ต่อ path เป็น URL */
export const ROUTER_BASENAME = RAW_BASE.replace(/\/$/, '');

/** basename ของ React Router — คง "/" ท้ายไว้ เพื่อให้ลิงก์หน้าแรกเป็น /sme-trust/ (Reload/เปิดแท็บใหม่ได้บน Static hosting) */
export const ROUTER_BASE = RAW_BASE;

/** path ภายในแอป → path จริงบนเว็บ (รวม base) เช่น /verify/X → /sme-trust/verify/X */
export const appPath = (path: string) => `${ROUTER_BASENAME}${path.startsWith('/') ? path : `/${path}`}`;

/** URL เต็มสำหรับ QR และลิงก์ตรวจสอบ — ชี้ไปยังหน้าภายใน Prototype เท่านั้น */
export const appUrl = (path: string) => `${window.location.origin}${appPath(path)}`;
