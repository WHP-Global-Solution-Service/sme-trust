export const nowISO = () => new Date().toISOString();

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/** สร้างเลขที่เอกสารแบบต่อเนื่องจากรายการเดิม เช่น CMP-2569-0021 */
export function nextRef(prefix: string, existing: string[], pad = 4): string {
  const year = new Date().getFullYear() + 543;
  const nums = existing
    .map((id) => Number(id.split('-').pop()))
    .filter((n) => !Number.isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(pad, '0')}`;
}

export function demoOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function mockIdentityId(): string {
  const hex = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `MID-${hex}-${String(Math.floor(Math.random() * 90) + 10)}`;
}
