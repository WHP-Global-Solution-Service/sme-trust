import type { Archetype, MarketplaceConnection, Platform } from '@/features/marketplace/types';
import { CONSENT_SCOPES, PLATFORMS } from '@/features/marketplace/data/platforms';
import { hashString } from '@/features/marketplace/services/prng';
import { daysBefore, demoAnchor } from './helpers';
import { merchants } from './merchants';

/**
 * การเชื่อมต่อ Marketplace ตัวอย่าง (จำลองทั้งหมด) — วันที่เป็นแบบสัมพัทธ์กับวันที่เริ่ม Demo (P7-D)
 * ข้อมูลปกติซิงก์ล่าสุด 1 วันก่อนวันเริ่ม Demo จึงไม่หมดอายุเมื่อเวลาผ่านไป · กรณีข้อมูลเก่าใช้ Fixture แยก (DATA_AGE_PRESETS) — Archetype สอดคล้องกับเรื่องราวของร้านใน v1
 * เช่น ร้านที่มีข้อร้องเรียนไม่ได้รับสินค้า = fulfillment_issue, ร้านที่ถูกเพิกถอน = ยอดขายดี (แสดงว่า Revoked แยกจาก Band)
 */
const shopName = (merchantId: string) => merchants.find((m) => m.id === merchantId)?.shopName ?? merchantId;

export const mockShopId = (key: string, platform: Platform) => `${PLATFORMS[platform].idPrefix}-${(hashString(`${key}:${platform}`) % 900_000) + 100_000}`;

/** อายุข้อมูลของการเชื่อมต่อตัวอย่าง (วัน นับจากวันเริ่ม Demo) */
const SEED_SYNC_AGE_DAYS = 1;
const SEED_CONNECTED_DAYS = 50;

function conn(anchor: Date, n: number, merchantId: string, platform: Platform, archetype: Archetype, extra: Partial<MarketplaceConnection> = {}): MarketplaceConnection {
  return {
    id: `MKC-${String(n).padStart(3, '0')}`,
    merchantId,
    platform,
    mockShopId: mockShopId(merchantId, platform),
    mockShopName: `${shopName(merchantId)} (${PLATFORMS[platform].label})`,
    status: 'connected',
    scopes: [...CONSENT_SCOPES],
    archetype,
    seed: hashString(`${merchantId}:${platform}:${archetype}`),
    createdAt: daysBefore(SEED_CONNECTED_DAYS, anchor),
    consentAt: daysBefore(SEED_CONNECTED_DAYS, anchor),
    lastSyncAt: daysBefore(SEED_SYNC_AGE_DAYS, anchor),
    syncSource: 'seed',
    ...extra,
  };
}

export const buildMarketplaceConnections = (anchor: Date = demoAnchor()): MarketplaceConnection[] => [
  conn(anchor, 1, 'M-001', 'shopee', 'established_good'),
  conn(anchor, 2, 'M-001', 'lazada', 'established_good'),
  conn(anchor, 3, 'M-005', 'shopee', 'growing_ok'),
  conn(anchor, 4, 'M-006', 'lazada', 'growing_ok'),
  conn(anchor, 5, 'M-006', 'shopee', 'growing_ok', { status: 'sync_failed', lastSyncAt: undefined, failReason: 'การเชื่อมต่อหมดเวลา (จำลอง) — กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง' }),
  conn(anchor, 6, 'M-003', 'shopee', 'review_burst'),
  conn(anchor, 7, 'M-004', 'shopee', 'fulfillment_issue'),
  conn(anchor, 8, 'M-004', 'lazada', 'fulfillment_issue'),
  conn(anchor, 9, 'M-008', 'shopee', 'established_good'),
  conn(anchor, 10, 'M-012', 'shopee', 'price_anomaly'),
  conn(anchor, 11, 'M-007', 'lazada', 'sales_spike'),
  conn(anchor, 12, 'M-009', 'shopee', 'growing_ok'),
  conn(anchor, 13, 'M-002', 'shopee', 'new_shop'),
];
