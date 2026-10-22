import type { Role } from '@/types';
import { useSessionStore } from '@/stores';

export const roleHome: Record<Role, string> = { merchant: '/m', consumer: '/check', officer: '/o', admin: '/admin' };

/** สลับบทบาทสำหรับการสาธิต (ไม่ใช่การยืนยันสิทธิ์จริง) */
export function switchRole(role: Role) {
  const s = useSessionStore.getState();
  s.set({
    role,
    officerId: role === 'admin' ? 'AD-001' : role === 'officer' && s.officerId === 'AD-001' ? 'OF-001' : s.officerId,
    merchantLoggedIn: role === 'merchant' ? !!s.operatorId : s.merchantLoggedIn,
  });
}
