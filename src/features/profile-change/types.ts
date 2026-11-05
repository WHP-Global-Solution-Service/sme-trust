import type { ISODate } from '@/types';
import type { Platform } from '@/features/marketplace/types';
import type { Tone } from '@/constants/labels';

/**
 * คำขอเปลี่ยนข้อมูลร้านที่ผูกกับใบรับรอง (ชื่อร้าน / หมวดธุรกิจ) — KI-V2-15
 * ข้อมูลเดิมในโปรไฟล์และใบรับรองไม่เปลี่ยนจนกว่าเจ้าหน้าที่อนุมัติ · ไม่อนุมัติอัตโนมัติ · ไม่เปลี่ยนระดับใบรับรอง
 */
export type ProfileChangeField = 'shopName' | 'category';
export const PROFILE_CHANGE_FIELDS: ProfileChangeField[] = ['shopName', 'category'];
export const PROFILE_CHANGE_FIELD_LABEL: Record<ProfileChangeField, string> = { shopName: 'ชื่อร้าน', category: 'หมวดหมู่ธุรกิจ' };

export type ProfileChangeStatus = 'pending' | 'info_requested' | 'approved' | 'rejected';

export const PROFILE_CHANGE_STATUS: Record<ProfileChangeStatus, { label: string; tone: Tone }> = {
  pending: { label: 'รอเจ้าหน้าที่พิจารณา', tone: 'warning' },
  info_requested: { label: 'ขอข้อมูลเพิ่มเติม', tone: 'info' },
  approved: { label: 'อนุมัติแล้ว', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'error' },
};

export interface ProfileChange {
  field: ProfileChangeField;
  /** ข้อมูลปัจจุบันในโปรไฟล์/ใบรับรอง (ก่อนเปลี่ยน) */
  from: string;
  /** ข้อมูลใหม่ที่ร้านขอ */
  to: string;
  /** ข้อมูลต้นฉบับจาก Marketplace (จำลอง) ณ เวลายื่น — อ่านอย่างเดียว */
  source?: string;
}

export type ProfileChangeAction = 'submitted' | 'updated' | 'resubmitted' | 'info_requested' | 'approved' | 'rejected';

export const PROFILE_CHANGE_ACTION_LABEL: Record<ProfileChangeAction, string> = {
  submitted: 'ร้านยื่นคำขอเปลี่ยนข้อมูล',
  updated: 'ร้านปรับข้อมูลในคำขอ',
  resubmitted: 'ร้านส่งข้อมูลเพิ่มเติม',
  info_requested: 'เจ้าหน้าที่ขอข้อมูลเพิ่มเติม',
  approved: 'เจ้าหน้าที่อนุมัติ',
  rejected: 'เจ้าหน้าที่ไม่อนุมัติ',
};

export interface ProfileChangeEvent {
  at: ISODate;
  actorRole: 'merchant' | 'officer';
  actorName: string;
  action: ProfileChangeAction;
  note?: string;
  changes?: ProfileChange[];
}

export interface ProfileChangeRequest {
  id: string;
  merchantId: string;
  operatorId: string;
  connectionId?: string;
  /** บันทึกการนำเข้าที่เป็นต้นทางของคำขอ (Scenario 9) */
  importId?: string;
  status: ProfileChangeStatus;
  changes: ProfileChange[];
  /** แหล่งข้อมูลต้นฉบับ (จำลอง) ณ เวลายื่น */
  source?: { platform: Platform; mockShopId: string };
  merchantNote?: string;
  /** ข้อความล่าสุดจากเจ้าหน้าที่ (ขอข้อมูลเพิ่ม / เหตุผลไม่อนุมัติ / หมายเหตุการอนุมัติ) */
  officerNote?: string;
  /** เพิ่มทุกครั้งที่ร้านแก้/ส่งใหม่ — กันการส่งซ้ำเมื่อ Refresh */
  revision: number;
  history: ProfileChangeEvent[];
  createdAt: ISODate;
  updatedAt: ISODate;
  decidedAt?: ISODate;
  decidedBy?: string;
}

export const isOpenChange = (r: Pick<ProfileChangeRequest, 'status'>) => r.status === 'pending' || r.status === 'info_requested';
