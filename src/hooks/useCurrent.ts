import { useMemo } from 'react';
import {
  useCertificationStore,
  useMerchantStore,
  useNotificationStore,
  useOperatorStore,
  useSessionStore,
} from '@/stores';
import { consumers, officers } from '@/mock/data';
import { currentCert, verdictFor, effectiveLevel } from '@/utils/trust';

export function useCurrentOperator() {
  const id = useSessionStore((s) => s.operatorId);
  return useOperatorStore((s) => s.items.find((o) => o.id === id));
}

/** ร้านค้าทั้งหมดของผู้ประกอบการปัจจุบัน และร้านที่เลือกอยู่ */
export function useMyMerchants() {
  const opId = useSessionStore((s) => s.operatorId);
  const activeId = useSessionStore((s) => s.activeMerchantId);
  const all = useMerchantStore((s) => s.items);
  return useMemo(() => {
    const mine = all.filter((m) => m.operatorId === opId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const active = mine.find((m) => m.id === activeId) ?? mine[0];
    return { mine, active };
  }, [all, opId, activeId]);
}

export function useMerchantView(merchantId?: string) {
  const merchant = useMerchantStore((s) => s.items.find((m) => m.id === merchantId));
  const operator = useOperatorStore((s) => s.items.find((o) => o.id === merchant?.operatorId));
  const certs = useCertificationStore((s) => s.items);
  return useMemo(() => {
    if (!merchant) return undefined;
    const cert = currentCert(certs, merchant.id);
    return { merchant, operator, cert, verdict: verdictFor(merchant, operator, cert), level: effectiveLevel(operator, cert) };
  }, [merchant, operator, certs]);
}

export function useCurrentConsumer() {
  const id = useSessionStore((s) => s.consumerId);
  return consumers.find((c) => c.id === id) ?? consumers[0];
}

export function useCurrentOfficer() {
  const id = useSessionStore((s) => s.officerId);
  return officers.find((o) => o.id === id) ?? officers[0];
}

/** การแจ้งเตือนของผู้ใช้ในบทบาทปัจจุบัน */
export function useMyNotifications() {
  const { role, operatorId, consumerId, officerId } = useSessionStore();
  const all = useNotificationStore((s) => s.items);
  return useMemo(() => {
    const myId = role === 'merchant' ? operatorId : role === 'consumer' ? consumerId : officerId;
    const list = all
      .filter((n) => n.recipientRole === role || (role === 'admin' && n.recipientRole === 'officer'))
      .filter((n) => !n.recipientId || n.recipientId === myId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { list, unread: list.filter((n) => !n.read).length };
  }, [all, role, operatorId, consumerId, officerId]);
}
