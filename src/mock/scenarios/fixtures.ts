/**
 * Scenario Fixtures — ปรับเฉพาะข้อมูลของกรณีศึกษาที่ Scenario ใช้ (ไม่ Reset ทั้งระบบ)
 * ทุกฟังก์ชันให้ผลเหมือนเดิมเมื่อเรียกซ้ำ (Idempotent)
 */
import { seed } from '@/mock/data';
import {
  useAuditStore,
  useCertificationStore,
  useComplaintStore,
  useMerchantStore,
  useNotificationStore,
  useOperatorStore,
  useRiskStore,
  useTrainingStore,
  useWarningStore,
} from '@/stores';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import { currentCert } from '@/utils/trust';

/** คืนค่ารายการหนึ่งให้เป็นแบบ Seed (ถ้ารายการถูกลบไปแล้วจะเพิ่มกลับ) */
function restore<T extends { id: string }>(store: { getState: () => { items: T[]; update: (id: string, p: Partial<T>) => void; add: (x: T) => void } }, seedItems: T[], id: string) {
  const original = seedItems.find((x) => x.id === id);
  if (!original) return;
  const st = store.getState();
  if (st.items.some((x) => x.id === id)) st.update(id, original);
  else st.add(original);
}

/** Scenario 5: กรณีศึกษาร้าน "สวยใสคอสเมติก" — คำเตือนเดิมถือเป็นประวัติที่ปิดแล้ว เจ้าหน้าที่จะออกคำเตือนใหม่ระหว่างสาธิต */
export function fixtureWarningCaseStudy() {
  restore(useWarningStore, seed.warnings(), 'WRN-2569-0001');
  useWarningStore.getState().update('WRN-2569-0001', (w) => ({
    status: 'completed',
    items: w.items.map((i) => ({ ...i, done: true })),
    timeline: [...w.timeline, { id: 'tl-fixture-s5', at: w.updatedAt, actor: 'system', actorName: 'ระบบ', title: 'ปิดรายการ (ประวัติก่อนการสาธิต)' }],
  }));
  restore(useTrainingStore, seed.enrollments(), 'ENR-005');
  // ความเสี่ยงของร้านกลับเป็นปกติ (ไม่มีคำเตือนค้าง) เพื่อให้คำเตือนใหม่เป็นจุดเริ่มต้นของเรื่อง
  useMerchantStore.getState().update('M-003', { riskStatus: 'none' });
}

/** Scenario 6: กรณีศึกษาร้าน "ไอทีแกดเจ็ตช็อป" — อยู่ระหว่างตรวจสอบ ยังไม่ระงับ */
export function fixtureBeforeSuspension() {
  restore(useRiskStore, seed.riskCases(), 'RSK-2569-0001');
  useRiskStore.getState().update('RSK-2569-0001', (r) => ({
    status: 'under_investigation',
    merchantStatement: undefined,
    appeal: undefined,
    timeline: r.timeline.slice(0, 2),
    updatedAt: r.timeline[1].at,
  }));
  const cert = currentCert(useCertificationStore.getState().items, 'M-004')!;
  restore(useCertificationStore, seed.certifications(), cert.id);
  useCertificationStore.getState().update(cert.id, (c) => ({ status: 'active', statusReason: undefined, history: c.history.slice(0, 1) }));
  useMerchantStore.getState().update('M-004', { riskStatus: 'under_investigation' });
  const notes = useNotificationStore.getState();
  notes.items.filter((n) => n.recipientId === 'OP-004' && n.title.includes('ระงับ')).forEach((n) => notes.remove(n.id));
  const audit = useAuditStore.getState();
  audit.items.filter((a) => a.target === cert.id && a.action.includes('ระงับ')).forEach((a) => audit.remove(a.id));
}

/** Scenario 7: เริ่มหน้าตรวจโฆษณาว่าง */
export function fixtureAdChecker() {
  useAiWorkspaceStore.getState().setAd({ text: '', source: 'custom', before: undefined, after: undefined, revisionDraft: undefined });
}

/** Scenario 8: เคส CMP-2569-0005 กลับเป็นสถานะรอร้านค้าตอบ และไม่มีร่างค้าง */
export function fixtureComplaintCase(caseId = 'CMP-2569-0005') {
  restore(useComplaintStore, seed.complaints(), caseId);
  const ws = useAiWorkspaceStore.getState();
  ws.setReplyDraft(caseId, undefined);
  ws.setComplaint({ caseId: undefined, source: 'custom', text: '', analysis: undefined, draft: undefined, draftEdited: false, variant: 0 });
}

export const operatorExists = (id?: string) => !!id && useOperatorStore.getState().items.some((o) => o.id === id);
