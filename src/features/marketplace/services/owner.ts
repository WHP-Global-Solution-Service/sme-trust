import type { MarketplaceConnection } from '../types';
import { ARCHETYPES } from '../data/archetypes';

/** ชื่อบุคคลสมมติ (จำลอง) — ไม่ใช่บุคคลจริง */
const OTHER_OWNERS = ['คุณวิภาดา ศรีสมบูรณ์ (จำลอง)', 'คุณธนวัฒน์ มั่นคงดี (จำลอง)', 'คุณปรียานุช แสงทองคำ (จำลอง)'];

/** ชื่อเจ้าของบัญชีร้านบน Marketplace ตาม Raw Source (จำลอง) — อ่านอย่างเดียว ร้านค้าแก้ไม่ได้ */
export function sourceOwnerName(c: Pick<MarketplaceConnection, 'archetype' | 'seed'>, verifiedName?: string): string {
  if (ARCHETYPES[c.archetype].ownerMismatch) return OTHER_OWNERS[Math.abs(c.seed) % OTHER_OWNERS.length];
  return verifiedName ?? 'เจ้าของร้าน (จำลอง)';
}

export const ownerMismatchOf = (c: Pick<MarketplaceConnection, 'archetype'>) => !!ARCHETYPES[c.archetype].ownerMismatch;
