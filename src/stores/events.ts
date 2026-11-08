/**
 * เหตุการณ์ข้อมูลร้านเปลี่ยน (Event-based Processing) — Workflow เดิม (v1) แจ้งเหตุการณ์ผ่านที่นี่
 * เพื่อให้ระบบอัตโนมัติอัปเดตสถานะ Badge ทันที (เช่น ระงับ/เพิกถอนการรับรอง) โดยไม่ต้องอ้างอิงกันแบบวน
 * ทำงานเฉพาะขณะผู้ใช้เปิดระบบ — ไม่ใช่การติดตามร้านค้าแบบ Real-time
 */
import type { AutomationTrigger } from '@/features/automation/types';

type Listener = (merchantId: string, trigger: AutomationTrigger) => void;
const listeners: Listener[] = [];
let muted = 0;

export function onMerchantChanged(l: Listener) {
  if (!listeners.includes(l)) listeners.push(l);
}

export function emitMerchantChanged(merchantId: string, trigger: AutomationTrigger) {
  if (muted > 0) return;
  listeners.forEach((l) => l(merchantId, trigger));
}

/** ระหว่างทำงานที่ประมวลผลเองอยู่แล้ว (เช่น เจ้าหน้าที่ตัดสินงาน) — ไม่ประมวลผลซ้ำจากเหตุการณ์ย่อย */
export function withoutEvents<T>(fn: () => T): T {
  muted++;
  try {
    return fn();
  } finally {
    muted--;
  }
}
