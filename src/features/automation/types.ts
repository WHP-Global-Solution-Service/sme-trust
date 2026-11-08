/**
 * Automation First, Human by Exception — ชนิดข้อมูลของ Decision Router, Assessment Badge และงานของเจ้าหน้าที่
 * ทุกอย่างเป็นข้อมูลจำลองใน Prototype (Frontend Only) — ไม่มีการประมวลผลเบื้องหลังเมื่อปิดหน้าเว็บ
 */
import type { ISODate } from '@/types';
import type { Band, BandOrInsufficient, ConfidenceLevel, Standing } from '@/features/trust-assessment/types';
import type { Platform } from '@/features/marketplace/types';

/** ผลการคัดกรองของ Decision Router — เป็นการคัดกรองเพื่อจัดเส้นทางงาน ไม่ใช่การตัดสินว่าร้านค้าทุจริต */
export type Route = 'AUTO_PASS' | 'AUTO_REQUEST_INFO' | 'MANUAL_REVIEW';

/** ประเภทประเด็นที่ระบบพบ */
export type IssueCategory =
  // ร้านค้าแก้ไขเองได้ (AUTO_REQUEST_INFO)
  | 'insufficient_data'
  | 'low_confidence'
  | 'stale_data'
  | 'sync_failed'
  | 'identity_unverified'
  // ต้องใช้เจ้าหน้าที่ (MANUAL_REVIEW)
  | 'identity_mismatch'
  | 'evidence_conflict'
  | 'risk_signal'
  | 'measure'
  // ข้อสังเกต (ไม่เปลี่ยนเส้นทาง)
  | 'advisory';

export type IssueKind = 'merchant_fixable' | 'manual' | 'advisory';
export type Priority = 'high' | 'medium' | 'low';

export interface RoutingIssue {
  category: IssueCategory;
  kind: IssueKind;
  title: string;
  detail: string;
  /** สิ่งที่ร้านค้าทำได้เอง (merchant_fixable / advisory) */
  action?: { label: string; to: string };
  priority: Priority;
  /** ลายนิ้วมือของประเด็น — ใช้กันงานซ้ำ (ประเด็นเดิม = Fingerprint เดิม) */
  fingerprint: string;
  /** ประเด็นที่อยู่ในกระบวนการเดิมของเจ้าหน้าที่แล้ว (เช่น เรื่องพิจารณาความเสี่ยง) — ไม่สร้างงานใหม่ */
  handledBy?: { kind: 'risk_case' | 'certification'; id: string; to: string };
  /** เจ้าหน้าที่ตรวจแล้วว่าไม่ต้องดำเนินการ (จากงานที่อนุมัติ) — ไม่ส่งตรวจซ้ำ */
  clearedByTask?: string;
  evidence: string[];
}

export interface RoutingDecision {
  route: Route;
  /** เหตุผลของเส้นทาง (อ่านได้ทั้งร้านค้าและเจ้าหน้าที่ — ไม่มีคะแนนภายใน) */
  reasons: string[];
  issues: RoutingIssue[];
}

/** สถานะของ Trust Assessment Badge — ผลประเมินอัตโนมัติ ไม่ใช่การรับรอง */
export type BadgeStatus =
  | 'active'
  | 'below_threshold'
  | 'insufficient'
  | 'needs_update'
  | 'under_review'
  | 'withheld'
  | 'suspended'
  | 'revoked';

export interface BadgeEvent {
  at: ISODate;
  status: BadgeStatus;
  band: BandOrInsufficient;
  confidence: ConfidenceLevel;
  coverage: number;
  route: Route;
  assessmentId: string;
  modelVersion: string;
  trigger: AutomationTrigger;
}

export interface AssessmentBadge {
  /** รหัส Badge เช่น TAB-M-001 (หนึ่ง Badge ต่อร้าน — อัปเดตเมื่อผลเปลี่ยน) */
  id: string;
  merchantId: string;
  status: BadgeStatus;
  band: BandOrInsufficient;
  confidence: ConfidenceLevel;
  coverage: number;
  route: Route;
  assessmentId: string;
  modelVersion: string;
  dataSources: Platform[];
  issuedAt: ISODate;
  updatedAt: ISODate;
  /** วันที่ประมวลผลล่าสุด (แม้ผลไม่เปลี่ยน) */
  checkedAt: ISODate;
  /** ประวัติการเปลี่ยนแปลงของ Badge (บันทึกเมื่อสถานะ/Band/ความเชื่อมั่นเปลี่ยนเท่านั้น) */
  history: BadgeEvent[];
}

/** เหตุการณ์ที่ทำให้ระบบประมวลผล (Event-based — ขณะผู้ใช้เปิดระบบเท่านั้น) */
export type AutomationTrigger =
  | 'seed'
  | 'import'
  | 'sync'
  | 'sync_failed'
  | 'data_age'
  | 'disconnect'
  | 'profile_update'
  | 'merchant_assessment'
  | 'merchant_response'
  | 'officer_decision'
  | 'measure_change'
  | 'identity_change'
  | 'simulation';

export type TaskCategory = 'identity_mismatch' | 'evidence_conflict' | 'risk_signal';
export type TaskStatus = 'open' | 'info_requested' | 'approved' | 'rejected' | 'auto_closed';
export type TaskAction = 'approve' | 'reject' | 'request_info';

export interface EvidenceSnapshot {
  capturedAt: ISODate;
  assessmentId: string;
  modelVersion: string;
  band: BandOrInsufficient;
  scoreBand: Band;
  /** คะแนนภายใน — แสดงเฉพาะเจ้าหน้าที่ */
  score: number;
  confidence: { level: ConfidenceLevel; score: number };
  coverage: number;
  standing: Standing;
  riskSignals: { id: string; label: string; value: string }[];
  connections: { id: string; platform: Platform; mockShopId: string; mockShopName: string; ownerName: string; lastSyncAt?: string }[];
  /** ชื่อผู้ยืนยันตัวตน (e-KYC จำลอง) */
  kycName?: string;
  items: string[];
}

export interface TaskEvent {
  id: string;
  at: ISODate;
  actor: 'system' | 'officer' | 'merchant';
  actorName: string;
  action: 'created' | 'updated' | 'approve' | 'reject' | 'request_info' | 'merchant_response' | 'auto_closed';
  note?: string;
}

/** งานของเจ้าหน้าที่จาก Decision Router — หนึ่งงานต่อประเด็น */
export interface OfficerTask {
  id: string;
  merchantId: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: Priority;
  fingerprint: string;
  title: string;
  /** สรุปเหตุผลที่ระบบส่งมาให้ตรวจ */
  summary: string;
  reasons: string[];
  connectionId?: string;
  evidence: EvidenceSnapshot;
  createdAt: ISODate;
  updatedAt: ISODate;
  resolution?: { action: TaskAction; note: string; by: string; at: ISODate; riskCaseId?: string };
  /** ข้อความล่าสุดที่ขอจากร้านค้า และคำตอบของร้าน */
  infoRequest?: { message: string; at: ISODate; response?: string; respondedAt?: ISODate };
  history: TaskEvent[];
}

/** บันทึกการประมวลผลแต่ละครั้ง — ใช้คำนวณ KPI และประวัติ (ข้อมูลจำลอง) */
export interface AutomationRun {
  id: string;
  merchantId: string;
  at: ISODate;
  trigger: AutomationTrigger;
  route: Route;
  badgeStatus: BadgeStatus;
  band: BandOrInsufficient;
  assessmentId: string;
  modelVersion: string;
  /** สร้างผลประเมินใหม่ในการประมวลผลครั้งนี้หรือไม่ */
  reassessed: boolean;
  taskIds: string[];
  reasons: string[];
}
