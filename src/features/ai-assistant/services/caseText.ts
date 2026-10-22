import type { Complaint } from '@/types';
import { fmtDate } from '@/utils/format';
import { OFFER_TYPE } from '@/constants/labels';

/** แปลงเคสใน Mock Complaint Center เป็นข้อความสำหรับวิเคราะห์ — ใช้เฉพาะข้อมูลที่มีอยู่ในเคส */
export function complaintCaseText(c: Complaint): string {
  const parts = [c.title, c.description];
  if (c.orderRef) parts.push(`เลขคำสั่งซื้อ ${c.orderRef}`);
  if (c.orderAmount) parts.push(`มูลค่า ${c.orderAmount.toLocaleString()} บาท`);
  if (c.incidentDate) parts.push(`วันที่เกิดเหตุ ${fmtDate(c.incidentDate)}`);
  if (c.evidence.length) parts.push(`แนบภาพ/หลักฐาน ${c.evidence.length} รายการ`);
  return parts.filter(Boolean).join('\n');
}

/** ข้อเสนอที่ร้านค้าบันทึกไว้แล้วในระบบ (ยืนยันจาก Mock Workflow) และยังรอผู้บริโภคพิจารณา */
export function pendingOffers(c: Complaint): string[] {
  return c.offers.filter((o) => o.status === 'pending' && o.type !== 'explain').map((o) => `ข้อเสนอ "${OFFER_TYPE[o.type]}" ที่ร้านแจ้งไว้`);
}
