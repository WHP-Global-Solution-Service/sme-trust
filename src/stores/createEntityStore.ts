import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EntityState<T extends { id: string }> {
  items: T[];
  add: (item: T) => void;
  update: (id: string, patch: Partial<T> | ((item: T) => Partial<T>)) => void;
  remove: (id: string) => void;
  reset: () => void;
}

/**
 * Namespace ของ localStorage สำหรับ SME Trust v2 (ทุก Base path)
 * - v2 เผยแพร่แทน v1 ที่ URL เดิม (/sme-trust/) — ผู้ที่เคยเปิด v1 มีข้อมูลสาธิตรูปแบบเก่าใต้ "smetrust:v1:"
 *   v2 จึงใช้ Namespace ใหม่ เพื่อไม่โหลดข้อมูลรูปแบบเก่า (ขาดข้อมูลตัวอย่างของ v2) เข้ามา
 * - ไม่ลบคีย์ของ v1 — หาก Rollback กลับเป็น v1 ข้อมูลสาธิตเดิมของผู้ใช้ยังอยู่ครบ
 */
export const STORAGE_PREFIX = 'smetrust:v2:';
/** Namespace ที่ v1 ใช้ (อ่านอย่างเดียวในการทดสอบ — v2 ไม่โหลดและไม่ลบ) */
export const LEGACY_V1_PREFIX = 'smetrust:v1:';

/** Store มาตรฐานสำหรับข้อมูลแต่ละ Domain — เก็บใน localStorage และ reset กลับเป็น seed ได้ */
export function createEntityStore<T extends { id: string }>(name: string, seed: () => T[]) {
  return create<EntityState<T>>()(
    persist(
      (set) => ({
        items: seed(),
        add: (item) => set((s) => ({ items: [item, ...s.items] })),
        update: (id, patch) =>
          set((s) => ({
            items: s.items.map((it) => (it.id === id ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it)),
          })),
        remove: (id) => set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
        reset: () => set({ items: seed() }),
      }),
      {
        name: `${STORAGE_PREFIX}${name}`,
        version: 1,
        // ข้อมูลใน localStorage เสียหายหรือรูปแบบไม่ถูกต้อง → ใช้ข้อมูลตัวอย่างแทน (ไม่ให้หน้าจอพัง)
        merge: (persisted, current) => {
          const items = (persisted as { items?: unknown } | undefined)?.items;
          const valid = Array.isArray(items) && items.every((it) => !!it && typeof it === 'object' && typeof (it as { id?: unknown }).id === 'string');
          return valid ? { ...current, items: items as T[] } : current;
        },
      },
    ),
  );
}
