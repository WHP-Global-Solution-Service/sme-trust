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

/** พารามิเตอร์ที่ 404.html ของ GitHub Pages ใช้ส่งต่อ Deep link มายังแอป (เช่น /sme-trust/v2/?__p=%2Fverify%2FX) */
export const DEEP_LINK_PARAM = '__p';

/**
 * คืนเส้นทางจริงจาก 404 Redirect ก่อน Router เริ่มทำงาน — ใช้เมื่อ v1 และ v2 อยู่ใน GitHub Pages เดียวกัน
 * (GitHub Pages มี 404.html ได้ไฟล์เดียวที่ราก จึงส่ง Deep link ของ v2 มาที่หน้าแรกของ v2 พร้อมพารามิเตอร์นี้)
 * รับเฉพาะ path ภายในแอป (ขึ้นต้นด้วย "/" และไม่ใช่ "//") เพื่อไม่ให้ใช้เป็น Open Redirect
 */
export function restoreDeepLink(loc: Pick<Location, 'search' | 'hash'> = window.location, history: Pick<History, 'replaceState' | 'state'> = window.history): string | undefined {
  const params = new URLSearchParams(loc.search);
  const raw = params.get(DEEP_LINK_PARAM);
  if (raw === null) return undefined;
  params.delete(DEEP_LINK_PARAM);
  const target = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  const rest = params.toString();
  const url = `${ROUTER_BASENAME}${target}${rest ? (target.includes('?') ? '&' : '?') + rest : ''}${loc.hash}`;
  history.replaceState(history.state, '', url);
  return url;
}
