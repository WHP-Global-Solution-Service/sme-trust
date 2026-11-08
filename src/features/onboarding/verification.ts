/**
 * Merchant KYC & Business Verification (จำลอง) — Pure Function ใช้ร่วมกันทั้ง Wizard หน้าร้านค้า และหน้าเจ้าหน้าที่
 * - ไม่ตรวจกับ DBD, สคบ. หรือระบบยืนยันตัวตนจริง · ไม่เก็บเลขบัตรประชาชนจริง (ใช้ Mock Reference แบบปิดบังบางส่วน)
 * - ข้อกำหนดเอกสารตามหมวดสินค้าเป็นกฎจำลองเพื่อการสาธิต — ข้อกำหนดจริงต้องตรวจสอบกับหน่วยงานที่เกี่ยวข้อง
 */
import type { BusinessType, Merchant, MockDocument, Operator } from '@/types';
import type { MarketplaceConnection } from '@/features/marketplace/types';
import { PLATFORMS } from '@/features/marketplace/data/platforms';
import { ownerMismatchOf } from '@/features/marketplace/services/owner';

export type IdentityDocType = 'id_card' | 'passport';
export const IDENTITY_DOC_LABEL: Record<IdentityDocType, string> = {
  id_card: 'บัตรประจำตัวประชาชน (จำลอง)',
  passport: 'หนังสือเดินทาง (จำลอง)',
};

/** Mock Reference แบบปิดบังบางส่วน เช่น MID-****-4821 — ไม่ใช่เลขบัตรประชาชน */
export const maskRef = (ref: string) => {
  const tail = ref.replace(/\D/g, '').slice(-4) || ref.slice(-4);
  return `${ref.split('-')[0] || 'MID'}-****-${tail}`;
};

/** สถานะการตรวจสอบนิติบุคคลแบบจำลอง (ไม่ได้ตรวจกับ DBD จริง) */
export type DbdMockStatus = 'verified_simulation' | 'invalid_format' | 'missing';
export function dbdMockStatus(registrationNo?: string): DbdMockStatus {
  if (!registrationNo?.trim()) return 'missing';
  return /^DEMO-\d{13}$/.test(registrationNo.trim()) ? 'verified_simulation' : 'invalid_format';
}
export const DBD_LABEL: Record<DbdMockStatus, string> = {
  verified_simulation: 'รูปแบบเลขทะเบียนถูกต้อง — ตรวจแบบจำลอง (ไม่ได้ตรวจกับ DBD จริง)',
  invalid_format: 'รูปแบบเลขทะเบียนไม่ถูกต้อง (ต้องเป็น DEMO- ตามด้วยตัวเลข 13 หลัก)',
  missing: 'ยังไม่ได้ระบุเลขทะเบียนนิติบุคคล (จำลอง)',
};

// ------------------------------------------------------------------ Dynamic Document Requirements

export interface DocRequirement {
  id: string;
  label: string;
  /** ชนิดเอกสารที่ยอมรับ (ตรงกับ kind ของเอกสารที่แนบ) */
  kinds: string[];
  level: 'required' | 'recommended';
  reason: string;
  /** ครบแล้วจากแหล่งอื่น (e-KYC / Marketplace) — ไม่ต้องแนบ */
  satisfiedBy?: string;
}

export interface DocRuleInput {
  businessType: BusinessType;
  category: string;
  /** ผู้สมัครเป็นผู้มีอำนาจลงนามเองหรือไม่ (นิติบุคคล) */
  applicantIsAuthorized?: boolean;
  kycVerified: boolean;
  /** นำเข้าข้อมูลร้านจาก Marketplace (จำลอง) แล้ว */
  marketplaceImported?: boolean;
}

/** หมวดสินค้าที่มีกฎหมายเฉพาะ (กฎจำลอง) */
export const CATEGORY_LICENSE: Record<string, { label: string; kinds: string[]; note: string }> = {
  อาหารและเครื่องดื่ม: { label: 'หลักฐานการขออนุญาตผลิตภัณฑ์อาหาร (เช่น เลขสารบบอาหาร)', kinds: ['ใบอนุญาตผลิตภัณฑ์อาหาร'], note: 'อาหารบางประเภทต้องขออนุญาตก่อนจำหน่าย' },
  ความงามและสุขภาพ: { label: 'หลักฐานการจดแจ้งเครื่องสำอาง / ผลิตภัณฑ์สุขภาพ', kinds: ['ใบรับจดแจ้งผลิตภัณฑ์'], note: 'เครื่องสำอางและผลิตภัณฑ์สุขภาพบางประเภทต้องจดแจ้งหรือขออนุญาต' },
  อิเล็กทรอนิกส์และแกดเจ็ต: { label: 'หลักฐานมาตรฐานผลิตภัณฑ์ (เช่น มอก.)', kinds: ['ใบรับรองมาตรฐานผลิตภัณฑ์'], note: 'เครื่องใช้ไฟฟ้าบางประเภทต้องได้มาตรฐานบังคับ' },
  ของเล่นและสินค้าเด็ก: { label: 'หลักฐานมาตรฐานของเล่น (เช่น มอก.)', kinds: ['ใบรับรองมาตรฐานผลิตภัณฑ์'], note: 'ของเล่นเด็กเป็นสินค้าควบคุมมาตรฐาน' },
};

export const LICENSE_DISCLAIMER = 'รายการหลักฐานตามหมวดสินค้าเป็นกฎจำลองเพื่อการสาธิต — ข้อกำหนดจริงต้องได้รับการตรวจสอบจากหน่วยงานที่เกี่ยวข้อง';

export function documentRequirements(i: DocRuleInput): DocRequirement[] {
  const out: DocRequirement[] = [];
  out.push({
    id: 'identity',
    label: 'ยืนยันตัวตนผู้ประกอบการ',
    kinds: [],
    level: 'required',
    reason: i.businessType === 'juristic' ? 'ผู้แทนที่สมัครต้องยืนยันตัวตน' : 'เจ้าของร้านต้องยืนยันตัวตน',
    satisfiedBy: i.kycVerified ? 'ยืนยันตัวตนด้วย e-KYC (จำลอง) แล้ว' : undefined,
  });
  if (i.businessType === 'juristic') {
    out.push({ id: 'company', label: 'หนังสือรับรองนิติบุคคล', kinds: ['หนังสือรับรองนิติบุคคล'], level: 'required', reason: 'ยืนยันการจดทะเบียนนิติบุคคล' });
    if (i.applicantIsAuthorized === false) out.push({ id: 'authorization', label: 'หนังสือมอบอำนาจจากผู้มีอำนาจลงนาม', kinds: ['หนังสือมอบอำนาจ'], level: 'required', reason: 'ผู้สมัครไม่ใช่ผู้มีอำนาจลงนาม' });
  } else {
    out.push({
      id: 'business',
      label: 'หลักฐานการประกอบธุรกิจ (อย่างน้อย 1 รายการ)',
      kinds: ['ทะเบียนพาณิชย์', 'ภาพสินค้า', 'ภาพสถานที่'],
      level: 'required',
      reason: 'แสดงว่ามีการประกอบธุรกิจจริง — บุคคลธรรมดาไม่จำเป็นต้องมีทะเบียนพาณิชย์ทุกราย',
    });
  }
  out.push({
    id: 'contact',
    label: 'หลักฐานช่องทางติดต่อ/ช่องทางขาย',
    kinds: ['ภาพสถานประกอบการ', 'ภาพหน้าร้านออนไลน์'],
    level: 'recommended',
    reason: 'ช่วยให้เจ้าหน้าที่และระบบตรวจสอบช่องทางขายได้เร็วขึ้น',
    satisfiedBy: i.marketplaceImported ? 'นำเข้าข้อมูลร้านจาก Marketplace (จำลอง) แล้ว' : undefined,
  });
  const lic = CATEGORY_LICENSE[i.category];
  if (lic) out.push({ id: 'license', label: lic.label, kinds: lic.kinds, level: 'recommended', reason: `${lic.note} (กฎจำลอง)` });
  return out;
}

export type DocCheck = DocRequirement & { met: boolean; matched: MockDocument[] };

export function checkDocuments(reqs: DocRequirement[], docs: MockDocument[]): { items: DocCheck[]; missingRequired: DocCheck[] } {
  const items = reqs.map((r) => {
    const matched = docs.filter((d) => r.kinds.includes(d.kind));
    return { ...r, matched, met: !!r.satisfiedBy || matched.length > 0 };
  });
  return { items, missingRequired: items.filter((x) => x.level === 'required' && !x.met) };
}

/** ชนิดเอกสารทั้งหมดที่แนบได้ตามกฎ */
export const acceptedKinds = (reqs: DocRequirement[]) => [...new Set(reqs.flatMap((r) => r.kinds))];

// ------------------------------------------------------------------ Verification Summary

export type VerifyState = 'verified_simulation' | 'pending' | 'missing' | 'conflicting' | 'not_required';
export const VERIFY_LABEL: Record<VerifyState, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  verified_simulation: { label: 'ตรวจแล้ว (จำลอง)', tone: 'success' },
  pending: { label: 'รอตรวจสอบ', tone: 'warning' },
  missing: { label: 'ขาด', tone: 'error' },
  conflicting: { label: 'ขัดแย้ง — ส่งเจ้าหน้าที่', tone: 'error' },
  not_required: { label: 'ไม่จำเป็น', tone: 'neutral' },
};

export interface VerifyItem {
  id: 'identity' | 'business' | 'representative' | 'ownership' | 'contact';
  label: string;
  state: VerifyState;
  detail: string;
}

/** สถานะความเป็นเจ้าของร้านบน Marketplace ของการเชื่อมต่อหนึ่งรายการ */
export type OwnershipState = 'matched' | 'mismatch' | 'claimed_elsewhere' | 'officer_verified' | 'rejected';
export const OWNERSHIP_LABEL: Record<OwnershipState, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  matched: { label: 'ชื่อเจ้าของตรงกับผู้ยืนยันตัวตน (จำลอง)', tone: 'success' },
  officer_verified: { label: 'เจ้าหน้าที่ยืนยันความเป็นเจ้าของแล้ว', tone: 'success' },
  mismatch: { label: 'ชื่อเจ้าของไม่ตรง — รอเจ้าหน้าที่ตรวจ', tone: 'error' },
  claimed_elsewhere: { label: 'ร้านนี้ถูกอ้างโดยร้านอื่นในระบบ — รอเจ้าหน้าที่ตรวจ', tone: 'error' },
  rejected: { label: 'ไม่ใช่ร้านของผู้ประกอบการ — ไม่ใช้ประเมิน', tone: 'neutral' },
};
export function ownershipOf(c: MarketplaceConnection): OwnershipState {
  if (c.identityReview?.status === 'rejected') return 'rejected';
  if (c.identityReview?.status === 'verified') return 'officer_verified';
  if (c.ownershipConflict) return 'claimed_elsewhere';
  if (ownerMismatchOf(c)) return 'mismatch';
  return 'matched';
}

export function verificationSummary(m: Merchant, op: Operator | undefined, connections: MarketplaceConnection[]): VerifyItem[] {
  const kyc = op?.kycStatus;
  const items: VerifyItem[] = [
    {
      id: 'identity',
      label: m.businessType === 'juristic' ? 'ตัวตนผู้แทนที่สมัคร' : 'ตัวตนเจ้าของร้าน',
      state: kyc === 'verified' ? 'verified_simulation' : kyc === 'failed' ? 'pending' : 'missing',
      detail: `${IDENTITY_DOC_LABEL[m.identityDocType ?? 'id_card']} · e-KYC: ${kyc === 'verified' ? 'ผ่าน (จำลอง)' : kyc === 'failed' ? 'ไม่ผ่าน — ลองใหม่ได้' : 'ยังไม่ยืนยัน'}${op ? ` · ${maskRef(op.mockIdentityId)}` : ''}`,
    },
  ];
  if (m.businessType === 'juristic') {
    const st = dbdMockStatus(m.juristic?.registrationNo);
    const hasCert = m.documents.some((d) => d.kind === 'หนังสือรับรองนิติบุคคล');
    items.push({ id: 'business', label: 'การจดทะเบียนนิติบุคคล', state: st === 'verified_simulation' && hasCert ? 'verified_simulation' : st === 'missing' || !hasCert ? 'missing' : 'pending', detail: `${m.juristic?.companyName ?? '-'} · ${DBD_LABEL[st]}${hasCert ? ' · แนบหนังสือรับรองแล้ว' : ' · ยังไม่แนบหนังสือรับรอง'}` });
    const self = !!m.juristic && m.juristic.authorizedPerson.trim() === m.juristic.applicantName.trim();
    const loa = m.documents.some((d) => d.kind === 'หนังสือมอบอำนาจ');
    items.push({ id: 'representative', label: 'ผู้แทนที่สมัคร', state: self ? 'not_required' : loa ? 'verified_simulation' : 'missing', detail: self ? 'ผู้สมัครเป็นผู้มีอำนาจลงนามเอง' : loa ? `มีหนังสือมอบอำนาจจาก ${m.juristic?.authorizedPerson}` : `ผู้สมัครไม่ใช่ผู้มีอำนาจลงนาม — ต้องแนบหนังสือมอบอำนาจ` });
  } else {
    const ev = m.documents.filter((d) => ['ทะเบียนพาณิชย์', 'ภาพสินค้า', 'ภาพสถานที่'].includes(d.kind));
    items.push({ id: 'business', label: 'หลักฐานการประกอบธุรกิจ', state: ev.length ? 'verified_simulation' : 'missing', detail: ev.length ? ev.map((d) => d.kind).join(', ') : 'ยังไม่มีหลักฐาน' });
  }
  const live = connections.filter((c) => c.merchantId === m.id && c.status !== 'disconnected');
  if (live.length) {
    const states = live.map(ownershipOf);
    const worst: VerifyState = states.some((s) => s === 'mismatch' || s === 'claimed_elsewhere') ? 'conflicting' : states.every((s) => s === 'rejected') ? 'missing' : 'verified_simulation';
    items.push({ id: 'ownership', label: 'ความเป็นเจ้าของร้านบน Marketplace', state: worst, detail: live.map((c, i) => `${PLATFORMS[c.platform].label} ${c.mockShopId}: ${OWNERSHIP_LABEL[states[i]].label}`).join(' · ') });
  } else {
    items.push({ id: 'ownership', label: 'ความเป็นเจ้าของร้านบน Marketplace', state: 'not_required', detail: 'ไม่ได้เชื่อม Marketplace — ประเมินจากข้อมูลที่มี (ไม่ใช่ผลลบ)' });
  }
  items.push({ id: 'contact', label: 'ช่องทางติดต่อ', state: m.phone && m.email ? 'verified_simulation' : 'missing', detail: `${m.phone ? 'มีเบอร์โทร' : 'ไม่มีเบอร์โทร'} · ${m.email ? 'มีอีเมล' : 'ไม่มีอีเมล'}${m.address ? ' · มีที่อยู่' : ''}` });
  return items;
}
