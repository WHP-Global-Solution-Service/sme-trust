import type { MockDocument, TimelineEvent } from '@/types';

/** แปลงวันที่เวลาไทย (UTC+7) เป็น ISO string */
export const d = (s: string) => new Date(`${s.length === 10 ? `${s}T09:00` : s}:00+07:00`).toISOString();

let seq = 0;
export const tl = (at: string, actor: TimelineEvent['actor'], title: string, note?: string, actorName?: string): TimelineEvent => ({
  id: `tl-seed-${++seq}`,
  at: d(at),
  actor,
  title,
  note,
  actorName,
});

export const doc = (name: string, kind: string, at: string, sizeKb = 320): MockDocument => ({
  id: `doc-seed-${++seq}`,
  name,
  kind,
  sizeKb,
  addedAt: d(at),
});

const DAY_MS = 86_400_000;

/**
 * วันอ้างอิงของ Demo — 09:00 น. (เวลาไทย) ของวันที่เริ่ม/Reset Demo
 * ใช้กับข้อมูลที่ต้องสัมพันธ์กับ "วันนี้" (เช่น วันที่ซิงก์ Marketplace) เพื่อไม่ให้ข้อมูลตัวอย่างหมดอายุเมื่อเวลาผ่านไป
 * ค่าเดียวกันตลอดทั้งวัน — Reset ซ้ำในวันเดียวกันได้ข้อมูลเหมือนเดิม
 */
export function demoAnchor(now: Date = new Date()): Date {
  const bkk = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate(), 2, 0, 0));
}

/** วันที่ย้อนหลัง n วันจากวันอ้างอิงของ Demo (ISO) */
export const daysBefore = (n: number, anchor: Date = demoAnchor()) => new Date(anchor.getTime() - n * DAY_MS).toISOString();
