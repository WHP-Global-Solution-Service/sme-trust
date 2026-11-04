import type {
  AppNotification,
  AuditEntry,
  Certification,
  Complaint,
  Enrollment,
  Merchant,
  Operator,
  RiskCase,
  VerificationApplication,
  WarningRecord,
} from '@/types';
import { seed } from '@/mock/data';
import type { AiHistoryEntry } from '@/features/ai-assistant/types/ai.types';
import type { MarketplaceConnection } from '@/features/marketplace/types';
import type { TrustAssessment } from '@/features/trust-assessment/types';
import type { MarketplaceImportRecord } from '@/features/marketplace/autofill';
import { createEntityStore } from './createEntityStore';

// ===== Domain stores (แหล่งข้อมูลเดียวของทุกหน้าจอ) =====
export const useOperatorStore = createEntityStore<Operator>('operators', seed.operators);
export const useMerchantStore = createEntityStore<Merchant>('merchants', seed.merchants);
export const useVerificationStore = createEntityStore<VerificationApplication>('applications', seed.applications);
export const useCertificationStore = createEntityStore<Certification>('certifications', seed.certifications);
export const useComplaintStore = createEntityStore<Complaint>('complaints', seed.complaints);
export const useWarningStore = createEntityStore<WarningRecord>('warnings', seed.warnings);
export const useRiskStore = createEntityStore<RiskCase>('risk', seed.riskCases);
export const useTrainingStore = createEntityStore<Enrollment>('enrollments', seed.enrollments);
export const useNotificationStore = createEntityStore<AppNotification>('notifications', seed.notifications);
export const useAuditStore = createEntityStore<AuditEntry>('audit', seed.audit);
/** ประวัติ AI Simulation (ไม่เก็บข้อความที่ผู้ใช้พิมพ์เอง) */
export const useAiHistoryStore = createEntityStore<AiHistoryEntry>('ai-history', seed.aiHistory);
/** v2: การเชื่อมต่อ Marketplace แบบจำลอง (ไม่มีการเชื่อมต่อ API จริง) */
export const useMarketplaceStore = createEntityStore<MarketplaceConnection>('marketplace-connections', seed.marketplaceConnections);
/** v2: ผลประเมินความน่าเชื่อถือ (Trust Assessment) */
export const useAssessmentStore = createEntityStore<TrustAssessment>('trust-assessments', seed.assessments);
/** v2: บันทึกการนำเข้าข้อมูลร้านจาก Marketplace (จำลอง) — ต้นฉบับเทียบกับข้อมูลที่ผู้สมัครแก้ไข */
export const useImportRecordStore = createEntityStore<MarketplaceImportRecord>('marketplace-imports', () => []);

export const domainStores = [
  useOperatorStore,
  useMerchantStore,
  useVerificationStore,
  useCertificationStore,
  useComplaintStore,
  useWarningStore,
  useRiskStore,
  useTrainingStore,
  useNotificationStore,
  useAuditStore,
  useAiHistoryStore,
  useMarketplaceStore,
  useAssessmentStore,
  useImportRecordStore,
];

export { useSessionStore } from './session';
export { useUiStore, toast, confirmDialog } from './ui';
