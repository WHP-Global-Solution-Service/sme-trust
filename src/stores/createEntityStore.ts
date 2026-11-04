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
 * Namespace ของ localStorage
 * - v2 ที่เผยแพร่ใต้ /<repo>/v2/ อยู่ Origin เดียวกับ v1 (github.io) จึงใช้ "smetrust:v2:" เพื่อไม่ให้ข้อมูลสาธิตของสองเวอร์ชันปนกัน
 * - Base อื่น (เช่น "/" ตอนพัฒนา/ทดสอบ หรือ /sme-trust/) ใช้ "smetrust:v1:" ตามเดิม
 */
const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
export const STORAGE_PREFIX = /\/v2\/$/.test(BASE) ? 'smetrust:v2:' : 'smetrust:v1:';

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
