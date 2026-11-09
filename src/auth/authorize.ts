/**
 * authorize() — บังคับสิทธิ์ในชั้น Store/Workflow (ไม่ใช่แค่ซ่อนเมนู)
 * ทุกฟังก์ชันที่เปลี่ยนข้อมูลในนามเจ้าหน้าที่/ผู้ดูแลระบบเรียก authorize() ก่อน — บทบาทที่ไม่มีสิทธิ์จะถูกปฏิเสธ
 * และบันทึกลง Audit Log โดยไม่มีการเปลี่ยนแปลงข้อมูลใด ๆ
 */
import { useAuditStore } from '@/stores';
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
