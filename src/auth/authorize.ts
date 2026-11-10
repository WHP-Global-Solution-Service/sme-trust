/**
 * authorize() — บังคับสิทธิ์ในชั้น Store/Workflow (ไม่ใช่แค่ซ่อนเมนู)
 * ทุกฟังก์ชันที่เปลี่ยนข้อมูลในนามเจ้าหน้าที่/ผู้ดูแลระบบเรียก authorize() ก่อน — บทบาทที่ไม่มีสิทธิ์จะถูกปฏิเสธ
 * และบันทึกลง Audit Log โดยไม่มีการเปลี่ยนแปลงข้อมูลใด ๆ
 */
import { useAuditStore, useMerchantStore } from '@/stores';
import { useSessionStore } from '@/stores/session';
import { ROLE_LABEL } from '@/constants/labels';
import { consumers, officers } from '@/mock/data';
import { nowISO, uid } from '@/utils/id';
import type { Role } from '@/types';
import { can, PERMISSIONS, type Permission, type PermissionDef } from './permissions';

export class PermissionDeniedError extends Error {
  constructor(
    readonly permission: Permission,
    readonly role: Role,
  ) {
    // ข้อความสำหรับแสดงผู้ใช้ — ไม่ใส่รหัสสิทธิ์ รหัสรายการ หรือรายละเอียดภายใน (รหัสสิทธิ์เก็บไว้ใน .permission)
    super(`ไม่มีสิทธิ์ดำเนินการ: ${(PERMISSIONS[permission] as PermissionDef).label}`);
    this.name = 'PermissionDeniedError';
  }
}

export const currentRole = (): Role => useSessionStore.getState().role;

function actorName(role: Role): string {
  const s = useSessionStore.getState();
  if (role === 'officer' || role === 'admin') return officers.find((o) => o.id === s.officerId)?.name ?? ROLE_LABEL[role];
  if (role === 'consumer') return consumers.find((c) => c.id === s.consumerId)?.name ?? ROLE_LABEL[role];
  return `${ROLE_LABEL[role]} ${s.operatorId}`;
}

/** ตรวจสิทธิ์ของบทบาทปัจจุบัน — ไม่มีสิทธิ์: บันทึก Audit แล้ว throw PermissionDeniedError (ไม่เปลี่ยนข้อมูล) */
export function authorize(permission: Permission): void {
  const role = currentRole();
  if (can(role, permission)) return;
  useAuditStore.getState().add({
    id: uid('AUD'),
    at: nowISO(),
    actorRole: role,
    actorName: actorName(role),
    action: 'ปฏิเสธการดำเนินการ (Permission Denied)',
    target: permission,
    detail: `${ROLE_LABEL[role]} ไม่มีสิทธิ์: ${(PERMISSIONS[permission] as PermissionDef).label}`,
  });
  throw new PermissionDeniedError(permission, role);
}

// ---------------------------------------------------------------------------
// Resource Ownership — ผู้ประกอบการทำรายการได้เฉพาะร้าน/บัญชีของตนเอง (Role Authorization + Resource Ownership)
// ความเป็นเจ้าของ: Merchant.operatorId === session.operatorId (บัญชีผู้ประกอบการที่เข้าสู่ระบบ — Mock Session)
// เจ้าหน้าที่/ผู้ดูแลระบบไม่ถูกตรวจ Ownership — ทำรายการตาม Permission ของบทบาท (ตรวจแล้วด้วย authorize)

export class OwnershipDeniedError extends PermissionDeniedError {
  constructor(permission: Permission, role: Role) {
    super(permission, role);
    // ข้อความสำหรับผู้ใช้ — ไม่ระบุรหัสร้าน/รายการ และไม่ยืนยันว่ารายการนั้นมีอยู่จริงหรือไม่
    this.message = 'ไม่มีสิทธิ์จัดการรายการนี้ — ทำรายการได้เฉพาะร้านค้าของบัญชีที่เข้าสู่ระบบ';
    this.name = 'OwnershipDeniedError';
  }
}

function denyOwnership(permission: Permission, role: Role): never {
  useAuditStore.getState().add({
    id: uid('AUD'),
    at: nowISO(),
    actorRole: role,
    actorName: actorName(role),
    action: 'ปฏิเสธการดำเนินการ (ไม่ใช่เจ้าของร้าน)',
    target: permission,
    detail: `ทำรายการกับร้านค้า/บัญชีที่ไม่ใช่ของตนเอง: ${(PERMISSIONS[permission] as PermissionDef).label}`,
  });
  throw new OwnershipDeniedError(permission, role);
}

/** บัญชีผู้ประกอบการที่เข้าสู่ระบบเป็นเจ้าของร้านนี้หรือไม่ (ไม่พบร้าน = ไม่ใช่เจ้าของ) */
export function ownsShop(merchantId: string | undefined): boolean {
  if (!merchantId) return false;
  const m = useMerchantStore.getState().items.find((x) => x.id === merchantId);
  return !!m && m.operatorId === useSessionStore.getState().operatorId;
}

/**
 * ต้องเป็นเจ้าของร้าน — เรียกหลัง authorize() และก่อนเปลี่ยนข้อมูลใด ๆ
 * merchantId มาจากร้านโดยตรง หรือจากรายการที่อ้างถึงร้าน (คำขอ คำเตือน ข้อร้องเรียน การเชื่อมต่อ ผลประเมิน ฯลฯ)
 * ไม่พบร้าน/รายการ → ถือว่าไม่ใช่เจ้าของ (ไม่สร้างข้อมูลให้ร้านที่ไม่มีอยู่)
 */
export function requireOwnShop(permission: Permission, merchantId: string | undefined): void {
  const role = currentRole();
  if (role !== 'merchant') return;
  if (!ownsShop(merchantId)) denyOwnership(permission, role);
}

/** ต้องเป็นบัญชีของตนเอง — สำหรับ Action ที่รับ operatorId (ลงทะเบียนร้าน อบรม ยืนยันตัวตน) */
export function requireOwnAccount(permission: Permission, operatorId: string | undefined): void {
  const role = currentRole();
  if (role !== 'merchant') return;
  if (!operatorId || operatorId !== useSessionStore.getState().operatorId) denyOwnership(permission, role);
}
