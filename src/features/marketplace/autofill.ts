/**
 * Marketplace-Assisted Registration (จำลอง) — นำเข้าข้อมูลร้านจาก Shopee/Lazada จำลอง แล้วเติมแบบฟอร์มอัตโนมัติ
 *
 * หลักการ
 * - Raw Source (ImportSource) ถูก "แช่แข็ง" ตอนยืนยันนำเข้า และคำนวณจาก Generator เดียวกับที่ Trust Assessment ใช้
 *   (Seed + Archetype + หมวดสินค้าต้นฉบับ) — การแก้ข้อมูลในแบบฟอร์มไม่เปลี่ยน Raw Source
 * - ทุกช่องมีสถานะที่มา: นำเข้า / ผู้สมัครแก้ไข / กรอกเอง / ต้องกรอกเพิ่ม / รอการตรวจสอบ
 * - ไม่มีการเรียก API ไม่รับรหัสผ่านหรือ Token และไม่สร้างข้อมูลเจ้าของร้านหรือเอกสารยืนยันตัวตน
 */
import type { ISODate } from '@/types';
import type { Archetype, Platform } from './types';
import { PLATFORMS } from './data/platforms';
import { productsOfCategory } from './data/catalog';
import { generateSnapshot } from './services/generator';
import { hashString, mulberry32, pick } from './services/prng';
import { BUSINESS_CATEGORIES } from '@/constants/labels';
import { mockShopId } from '@/mock/data/marketplace';

// ------------------------------------------------------------------ ร้านบนบัญชี Marketplace (จำลอง)

/** ร้านที่ "พบในบัญชี" หลังอนุญาตเข้าถึง (จำลอง) */
export interface MockMarketplaceShop {
  /** คีย์ของร้าน — ใช้เป็นรหัสอ้างอิงของ Snapshot ต้นฉบับ */
  key: string;
  platform: Platform;
  archetype: Archetype;
  mockShopId: string;
  shopName: string;
  category: string;
  note: string;
}

const SHOP_VARIANTS: { archetype: Archetype; suffix: string; note: string }[] = [
  { archetype: 'growing_ok', suffix: '', note: 'ร้านหลัก — ขายมาไม่ถึงปี ยอดโตปกติ รีวิวดี' },
  { archetype: 'established_good', suffix: ' Official', note: 'ขายมานาน ผลงานดี ยอดขายสม่ำเสมอ' },
  { archetype: 'new_shop', suffix: ' Outlet', note: 'เพิ่งเปิด คำสั่งซื้อและรีวิวยังน้อย' },
];

/** ร้านตัวอย่างในบัญชี Marketplace ของผู้ประกอบการ (Deterministic ตามรหัสบัญชีและแพลตฟอร์ม) */
export function mockAccountShops(ownerKey: string, ownerName: string, platform: Platform): MockMarketplaceShop[] {
  const rng = mulberry32(hashString(`${ownerKey}:${platform}:account`));
  const category = pick(rng, BUSINESS_CATEGORIES.filter((c) => c !== 'บริการ'));
  const first = ownerName.split(' ')[0] || 'ใหม่';
  const base = `ร้าน${first}${pick(rng, ['ช็อป', 'สโตร์', 'มาร์เก็ต'])}`;
  return SHOP_VARIANTS.map((v, i) => {
    const key = `SRC-${platform}-${ownerKey}-${i + 1}`;
    return { key, platform, archetype: v.archetype, mockShopId: mockShopId(key, platform), shopName: `${base}${v.suffix}`, category, note: v.note };
  });
}

// ------------------------------------------------------------------ Raw Source (แช่แข็งตอนยืนยันนำเข้า)

export interface ImportedProduct {
  name: string;
  category: string;
  price: number;
}

export interface ImportSource {
  key: string;
  platform: Platform;
  archetype: Archetype;
  seed: number;
  mockShopId: string;
  shopName: string;
  /** ลิงก์ร้านจำลอง (ไม่ใช่โดเมนจริง และไม่เปิดเป็นลิงก์) */
  shopUrl: string;
  description: string;
  avatar: { initials: string; hue: number };
  /** หมวดหลักของร้านบนแพลตฟอร์ม และหมวดของสินค้าทั้งหมด */
  category: string;
  categories: string[];
  products: ImportedProduct[];
  rating: number;
  reviewCount: number;
  /** คำสั่งซื้อรวม 12 เดือน */
  salesVolume: number;
  lastSyncAt: ISODate;
  importedAt: ISODate;
}

export const sourceSeed = (key: string, archetype: Archetype) => hashString(`${key}:${archetype}:source`);
export const mockShopUrl = (platform: Platform, shopId: string) => `${PLATFORMS[platform].short.toLowerCase()}.mock/shop/${shopId}`;

/**
 * สร้าง Raw Source จาก Snapshot ที่ Generator สร้าง — ตัวเลขเดียวกับที่ใช้ประเมิน (Seed/Archetype/หมวดต้นฉบับเดียวกัน)
 * key คือรหัสอ้างอิงของ Snapshot (ร้านใหม่: คีย์ร้าน / ร้านเดิม: รหัสการเชื่อมต่อ)
 */
export function buildImportSource(args: {
  key: string;
  platform: Platform;
  archetype: Archetype;
  seed: number;
  mockShopId: string;
  shopName: string;
  category: string;
  lastSyncAt?: ISODate;
  now?: Date;
}): ImportSource {
  const snap = generateSnapshot({ id: args.key, platform: args.platform, archetype: args.archetype, seed: args.seed, sourceCategory: args.category }, args.category);
  const reviews = snap.totalReviews;
  const rating = reviews ? snap.ratingHistogram.reduce((s, c, i) => s + c * (i + 1), 0) / reviews : 0;
  const products = snap.listings.map((l) => ({ name: l.name, category: l.category, price: l.price }));
  const names = (products.length ? products : productsOfCategory(args.category).slice(0, 3)).map((p) => p.name);
  const now = (args.now ?? new Date()).toISOString();
  const hue = hashString(args.shopName) % 360;
  return {
    key: args.key,
    platform: args.platform,
    archetype: args.archetype,
    seed: args.seed,
    mockShopId: args.mockShopId,
    shopName: args.shopName,
    shopUrl: mockShopUrl(args.platform, args.mockShopId),
    description: `จำหน่าย${names.slice(0, 3).join(' ')} ส่งทั่วประเทศ เปลี่ยนสินค้าได้ภายใน 7 วันหากสินค้าเสียหายจากการขนส่ง (ข้อความร้านบน ${PLATFORMS[args.platform].label})`,
    avatar: { initials: args.shopName.replace(/^ร้าน/, '').slice(0, 2) || 'ร้', hue },
    category: args.category,
    categories: [...new Set(products.map((p) => p.category))],
    products,
    rating: Math.round(rating * 100) / 100,
    reviewCount: reviews,
    salesVolume: snap.monthlyOrders.reduce((a, b) => a + b, 0),
    lastSyncAt: args.lastSyncAt ?? now,
    importedAt: now,
  };
}

/** Raw Source ของร้านในบัญชี Marketplace (เส้นทางสมัครร้านใหม่) */
export const sourceOfShop = (shop: MockMarketplaceShop, now?: Date) =>
  buildImportSource({ key: shop.key, platform: shop.platform, archetype: shop.archetype, seed: sourceSeed(shop.key, shop.archetype), mockShopId: shop.mockShopId, shopName: shop.shopName, category: shop.category, now });

// ------------------------------------------------------------------ ช่องข้อมูลและสถานะที่มา

export type FieldKey = 'shopName' | 'description' | 'category' | 'phone' | 'email' | 'province' | 'district' | 'address';
export const FIELD_KEYS: FieldKey[] = ['shopName', 'description', 'category', 'phone', 'email', 'province', 'district', 'address'];
export const FIELD_LABEL: Record<FieldKey, string> = {
  shopName: 'ชื่อร้านที่ใช้สมัคร',
  description: 'คำอธิบายธุรกิจ',
  category: 'หมวดหมู่ธุรกิจ',
  phone: 'เบอร์โทรศัพท์ร้าน',
  email: 'อีเมลร้าน',
  province: 'จังหวัด',
  district: 'อำเภอ/เขต',
  address: 'ที่อยู่ธุรกิจ',
};

export type FieldValues = Record<FieldKey, string>;
export type FieldStatus = 'imported' | 'user_edited' | 'manual' | 'missing' | 'verification_required';

export const FIELD_STATUS_LABEL: Record<FieldStatus, string> = {
  imported: 'นำเข้าแล้ว',
  user_edited: 'ผู้สมัครแก้ไข',
  manual: 'กรอกเอง',
  missing: 'ต้องกรอกเพิ่ม',
  verification_required: 'รอการตรวจสอบ',
};

/** ค่าที่ Raw Source มี (ช่องอื่นไม่มีในแหล่งข้อมูล — ต้องกรอกเพิ่ม) */
export const importedValues = (src: ImportSource): Partial<FieldValues> => ({ shopName: src.shopName, description: src.description, category: src.category });

export interface FieldRow {
  key: FieldKey;
  label: string;
  status: FieldStatus;
  current: string;
  /** ค่าจาก Marketplace (ถ้ามี) */
  imported?: string;
  /** ค่าที่ลงทะเบียนไว้เดิม (กรณีร้านเดิมอัปเดตโปรไฟล์) */
  registered?: string;
  required: boolean;
}

export interface StatusRules {
  imported: Partial<FieldValues>;
  required: FieldKey[];
  /** ช่องที่ถ้าต่างจากต้นฉบับ/ข้อมูลเดิม ต้องให้เจ้าหน้าที่ตรวจสอบ */
  verifyOnChange: FieldKey[];
  /** ข้อมูลที่ลงทะเบียนไว้เดิม (ร้านเดิม) */
  registered?: Partial<FieldValues>;
}

const norm = (v?: string) => (v ?? '').trim();

export function fieldStatus(key: FieldKey, current: string, r: StatusRules): FieldStatus {
  const cur = norm(current);
  const required = r.required.includes(key);
  if (!cur) return required ? 'missing' : 'manual';
  const imp = r.imported[key];
  const reg = r.registered?.[key];
  // ร้านเดิม: ช่องที่ผูกกับใบรับรองเทียบกับข้อมูลที่อนุมัติแล้วในระบบ (ชื่อร้านที่เจ้าหน้าที่อนุมัติให้เปลี่ยนแล้วไม่ต้องตรวจซ้ำ)
  if (reg !== undefined && r.verifyOnChange.includes(key)) {
    if (cur !== norm(reg)) return 'verification_required';
    return imp !== undefined && cur === norm(imp) ? 'imported' : 'manual';
  }
  const reference = imp !== undefined ? norm(imp) : reg !== undefined ? norm(reg) : undefined;
  if (reference === undefined) return 'manual';
  if (cur === reference) return imp !== undefined ? 'imported' : 'manual';
  return r.verifyOnChange.includes(key) ? 'verification_required' : 'user_edited';
}

export function fieldRows(values: FieldValues, r: StatusRules): FieldRow[] {
  return FIELD_KEYS.map((key) => ({
    key,
    label: FIELD_LABEL[key],
    status: fieldStatus(key, values[key], r),
    current: norm(values[key]),
    imported: r.imported[key],
    registered: r.registered?.[key],
    required: r.required.includes(key),
  }));
}

export interface ImportSummary {
  imported: number;
  edited: number;
  missing: number;
  verification: number;
  manual: number;
}

export function summarize(rows: FieldRow[]): ImportSummary {
  const n = (s: FieldStatus) => rows.filter((x) => x.status === s).length;
  return { imported: n('imported'), edited: n('user_edited') + n('verification_required'), missing: n('missing'), verification: n('verification_required'), manual: n('manual') };
}

/** กฎของเส้นทางสมัครร้านใหม่ */
export const newRegistrationRules = (src: ImportSource, juristic = false): StatusRules => ({
  imported: importedValues(src),
  required: ['shopName', 'description', 'category', 'phone', 'email', 'province', 'district', ...(juristic ? (['address'] as FieldKey[]) : [])],
  verifyOnChange: ['shopName'],
});

/** กฎของร้านเดิมที่อัปเดตโปรไฟล์จาก Marketplace — ชื่อร้าน/หมวดที่ผูกกับใบรับรองต้องให้เจ้าหน้าที่ตรวจก่อน */
export const profileUpdateRules = (src: ImportSource, registered: FieldValues): StatusRules => ({
  imported: importedValues(src),
  required: ['shopName', 'description', 'category', 'phone', 'email', 'province', 'district'],
  verifyOnChange: ['shopName', 'category'],
  registered,
});

/**
 * ยกเลิกการนำเข้า: ช่องที่ยังเป็นค่าจากแหล่งข้อมูล (ไม่ได้แก้) ถูกล้าง — ช่องที่ผู้สมัครแก้หรือกรอกเองยังอยู่
 * (ข้อมูลต้นฉบับไม่ถูกใช้ต่อ แต่ไม่ลบสิ่งที่ผู้สมัครพิมพ์เอง)
 */
export function clearImported(values: FieldValues, src: ImportSource): FieldValues {
  const imp = importedValues(src);
  const out = { ...values };
  (Object.keys(imp) as FieldKey[]).forEach((k) => {
    if (norm(out[k]) === norm(imp[k])) out[k] = '';
  });
  return out;
}

// ------------------------------------------------------------------ บันทึกการนำเข้า (ให้เจ้าหน้าที่ตรวจ)

export type ImportMode = 'new_registration' | 'profile_update';

/** บันทึกการนำเข้าข้อมูลที่ผู้ใช้ยืนยันแล้ว — Raw Source แยกจากข้อมูลที่ผู้สมัครส่ง */
export interface MarketplaceImportRecord {
  id: string;
  mode: ImportMode;
  operatorId: string;
  merchantId: string;
  connectionId?: string;
  applicationId?: string;
  /** รหัสฉบับร่าง — ส่งซ้ำ/Refresh แล้วไม่สร้างบันทึกหรือคำขอซ้ำ */
  draftId: string;
  source: ImportSource;
  /** ข้อมูลเดิมในระบบก่อนอัปเดต (ร้านเดิม) */
  registered?: FieldValues;
  submitted: FieldValues;
  rows: FieldRow[];
  summary: ImportSummary;
  /** ช่องที่บันทึกลงโปรไฟล์ร้านแล้ว และช่องที่รอเจ้าหน้าที่ตรวจ (ยังไม่เปลี่ยน) */
  applied: FieldKey[];
  pending: FieldKey[];
  /** คำขอเปลี่ยนข้อมูลที่ผูกกับใบรับรอง (ถ้ามีช่องที่รอการตรวจสอบ) */
  changeRequestId?: string;
  createdAt: ISODate;
}
