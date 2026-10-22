import type { AiHistoryEntry } from '@/features/ai-assistant/types/ai.types';
import { d } from './helpers';

/** ประวัติการวิเคราะห์ตั้งต้น (สาธิต) — เก็บเฉพาะชื่อตัวอย่าง/Case ID ไม่เก็บข้อความที่ผู้ใช้พิมพ์ */
export const aiHistory: AiHistoryEntry[] = [
  { id: 'AIH-seed-4', type: 'complaint', source: 'เคส CMP-2569-0013', resultCategory: 'สินค้าชำรุด', level: 'Normal', createdAt: d('2026-10-12T15:20') },
  { id: 'AIH-seed-3', type: 'advertising', source: 'ข้อความที่ปรับตามข้อเสนอ', resultCategory: 'โปรโมชัน/ของแถม', level: 'Low', createdAt: d('2026-10-08T10:12') },
  { id: 'AIH-seed-2', type: 'advertising', source: 'ตัวอย่าง: รับประกันผลลัพธ์ 100%', resultCategory: 'รับประกันผลลัพธ์', level: 'High', createdAt: d('2026-10-08T10:05') },
  { id: 'AIH-seed-1', type: 'complaint', source: 'ตัวอย่าง: ชำระเงินแล้วไม่ได้รับสินค้า', resultCategory: 'ไม่ได้รับสินค้า', level: 'Attention', createdAt: d('2026-10-05T09:30') },
];
