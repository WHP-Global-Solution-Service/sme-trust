import type { Certification, Merchant, Operator, TrustLevel } from '@/types';
import type { Tone } from '@/constants/labels';

export type VerdictKey =
  | 'certified'
  | 'business'
  | 'identity'
  | 'unverified'
  | 'expired'
  | 'suspended'
  | 'revoked'
  | 'pending';

export interface Verdict {
  key: VerdictKey;
  label: string;
  tone: Tone;
  desc: string;
  usable: boolean;
}

export const VERDICTS: Record<VerdictKey, Omit<Verdict, 'key'>> = {
  certified: {
    label: 'ได้รับการรับรอง',
    tone: 'success',
    desc: 'ร้านค้าผ่านการตรวจสอบธุรกิจ ผ่านการอบรม และใบรับรองยังใช้งานได้ (ข้อมูลสาธิต)',
    usable: true,
  },
  business: {
    label: 'ผ่านเกณฑ์ธุรกิจ',
    tone: 'primary',
    desc: 'ตรวจสอบข้อมูลธุรกิจและเอกสารแล้ว แต่ยังไม่ใช่ระดับ Trusted SME',
    usable: true,
  },
  identity: {
    label: 'ยืนยันตัวตนแล้ว',
    tone: 'info',
    desc: 'ยืนยันตัวตนเจ้าของร้านแล้วเท่านั้น ไม่ใช่การรับรองคุณภาพสินค้าหรือธุรกิจ',
    usable: false,
  },
  pending: {
    label: 'อยู่ระหว่างยื่นคำขอ',
    tone: 'warning',
    desc: 'ร้านค้ายื่นคำขอแล้ว อยู่ระหว่างการพิจารณา ยังไม่ได้รับการรับรอง',
    usable: false,
  },
  unverified: {
    label: 'ยังไม่ยืนยันตัวตน',
    tone: 'neutral',
    desc: 'ร้านค้ายังไม่ผ่านการยืนยันตัวตน ไม่ได้หมายความว่าร้านค้ากระทำผิด',
    usable: false,
  },
  expired: {
    label: 'ใบรับรองหมดอายุ',
    tone: 'neutral',
    desc: 'ใบรับรองหมดอายุแล้ว ร้านค้าต้องต่ออายุก่อนจึงจะใช้สถานะรับรองได้อีกครั้ง',
    usable: false,
  },
  suspended: {
    label: 'ถูกระงับการรับรอง',
    tone: 'error',
    desc: 'การรับรองถูกระงับชั่วคราว ระหว่างตรวจสอบหรือรอการแก้ไข ใบรับรองนี้ใช้งานไม่ได้ในขณะนี้',
    usable: false,
  },
  revoked: {
    label: 'ถูกเพิกถอนการรับรอง',
    tone: 'error',
    desc: 'การรับรองถูกเพิกถอนแล้ว ใบรับรองนี้ใช้งานไม่ได้',
    usable: false,
  },
};

/** ใบรับรองล่าสุดของร้าน (ตามวันที่ออก) */
export function currentCert(certs: Certification[], merchantId: string): Certification | undefined {
  return certs
    .filter((c) => c.merchantId === merchantId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0];
}

export function verdictFor(m: Merchant, op: Operator | undefined, cert: Certification | undefined): Verdict {
  let key: VerdictKey;
  if (cert?.status === 'revoked') key = 'revoked';
  else if (cert?.status === 'suspended' || m.riskStatus === 'suspended') key = 'suspended';
  else if (cert?.status === 'expired') key = 'expired';
  else if (cert?.status === 'active' && cert.level >= 3) key = 'certified';
  else if (cert?.status === 'active' && cert.level === 2) key = 'business';
  else if (op?.kycStatus === 'verified' && ['submitted', 'pending_review', 'under_verification', 'need_info'].includes(m.registrationStatus))
    key = 'pending';
  else if (op?.kycStatus === 'verified') key = 'identity';
  else key = 'unverified';
  return { key, ...VERDICTS[key] };
}

/** ระดับความน่าเชื่อถือที่ใช้งานได้จริงในขณะนี้ */
export function effectiveLevel(op: Operator | undefined, cert: Certification | undefined): TrustLevel {
  if (cert?.status === 'active') return cert.level;
  if (op?.kycStatus === 'verified') return 1;
  return 0;
}

export function isPublicMerchant(m: Merchant): boolean {
  return m.registrationStatus !== 'draft';
}
