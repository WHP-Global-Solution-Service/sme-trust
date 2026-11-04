// ===== Domain models ของ SME Trust Platform (ข้อมูลจำลองทั้งหมด) =====

export type Role = 'merchant' | 'consumer' | 'officer' | 'admin';

export type ISODate = string;

export interface TimelineEvent {
  id: string;
  at: ISODate;
  actor: 'merchant' | 'consumer' | 'officer' | 'admin' | 'system';
  actorName?: string;
  title: string;
  note?: string;
}

export interface MockDocument {
  id: string;
  name: string;
  kind: string;
  sizeKb: number;
  addedAt: ISODate;
}

// ----- ผู้ประกอบการ (บุคคล) -----
export type KycStatus = 'none' | 'verified' | 'failed';

export interface Operator {
  id: string;
  /** รหัสตัวตนจำลองภายในระบบ — ไม่ใช่เลขบัตรประชาชน */
  mockIdentityId: string;
  name: string;
  phone: string;
  email: string;
  province: string;
  kycStatus: KycStatus;
  kycVerifiedAt?: ISODate;
  /** PIN สาธิตเท่านั้น ไม่ใช่กลไกความปลอดภัยจริง */
  demoPin: string;
  createdAt: ISODate;
}

// ----- ร้านค้า -----
export type BusinessType = 'individual' | 'juristic';

export type RegistrationStatus =
  | 'draft'
  | 'submitted'
  | 'pending_review'
  | 'need_info'
  | 'under_verification'
  | 'approved'
  | 'rejected';

export type RiskStatus =
  | 'none'
  | 'allegation'
  | 'under_investigation'
  | 'warning'
  | 'suspended'
  | 'revoked'
  | 'appeal_submitted'
  | 'appeal_reviewed';

export type ChannelType = 'facebook' | 'tiktok' | 'line' | 'website' | 'marketplace';
export type ChannelStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface SalesChannel {
  id: string;
  type: ChannelType;
  handle: string;
  status: ChannelStatus;
  verifiedAt?: ISODate;
  note?: string;
}

export interface JuristicInfo {
  companyName: string;
  registrationNo: string; // เลขทะเบียนจำลอง
  companyType: string;
  authorizedPerson: string;
  applicantName: string;
}

export interface Merchant {
  id: string;
  operatorId: string;
  shopName: string;
  businessType: BusinessType;
  ownerName: string;
  juristic?: JuristicInfo;
  category: string;
  province: string;
  district: string;
  address?: string;
  phone: string;
  email: string;
  description: string;
  channels: SalesChannel[];
  documents: MockDocument[];
  registrationStatus: RegistrationStatus;
  riskStatus: RiskStatus;
  createdAt: ISODate;
  approvedAt?: ISODate;
  /** ข้อสังเกตจากระบบ เช่น ตรวจพบ Mock Identity เดียวกับร้านที่ถูกระงับ */
  identityFlag?: string;
}

// ----- คำขอตรวจสอบ -----
export type ApplicationType = 'registration' | 'certification';

export interface VerificationCheck {
  id: string;
  label: string;
  result: 'pass' | 'fail' | 'pending';
}

export interface VerificationApplication {
  id: string;
  merchantId: string;
  type: ApplicationType;
  requestedLevel: TrustLevel;
  status: RegistrationStatus;
  submittedAt: ISODate;
  updatedAt: ISODate;
  assignedOfficerId?: string;
  checks: VerificationCheck[];
  infoRequest?: string;
  rejectReason?: string;
  timeline: TimelineEvent[];
  /** v2: รหัสฉบับร่างที่ใช้ส่งคำขอ — ส่งซ้ำแล้วได้คำขอเดิม (ไม่สร้างซ้ำ) */
  sourceDraftId?: string;
  /** v2: บันทึกการนำเข้าข้อมูลจาก Marketplace (จำลอง) ที่ใช้เติมแบบฟอร์ม */
  importId?: string;
}

// ----- การรับรอง -----
export type TrustLevel = 0 | 1 | 2 | 3 | 4;
export type CertStatus = 'active' | 'expired' | 'suspended' | 'revoked';

export interface Certification {
  id: string; // เลขอ้างอิงใบรับรองสมมติ
  merchantId: string;
  level: TrustLevel;
  status: CertStatus;
  issuedAt: ISODate;
  expiresAt: ISODate;
  statusReason?: string;
  supersededBy?: string;
  history: TimelineEvent[];
}

// ----- ข้อร้องเรียน -----
export type ComplaintCategory =
  | 'not_received'
  | 'not_as_described'
  | 'refund_refused'
  | 'misleading_ad'
  | 'defective'
  | 'service_breach'
  | 'other';

export type ComplaintStatus =
  | 'submitted'
  | 'awaiting_merchant'
  | 'merchant_responded'
  | 'waiting_consumer'
  | 'resolved'
  | 'escalated'
  | 'closed';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ScreeningResult {
  suggestedCategory: ComplaintCategory;
  missing: string[];
  nextStep: string;
  priority: Priority;
  duplicateOf: string[];
  severe: boolean;
  reasons: string[];
  completeness: number; // 0-100
}

export type OfferType = 'refund' | 'replace' | 'reship' | 'explain' | 'request_info';
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'negotiate';

export interface ResolutionOffer {
  id: string;
  type: OfferType;
  amount?: number;
  note: string;
  status: OfferStatus;
  createdAt: ISODate;
  consumerReply?: string;
}

export interface CaseMessage {
  id: string;
  from: 'consumer' | 'merchant' | 'officer' | 'system';
  text: string;
  at: ISODate;
  attachment?: MockDocument;
}

export interface Complaint {
  id: string;
  merchantId: string;
  consumerId: string;
  category: ComplaintCategory;
  officerCategory?: ComplaintCategory;
  title: string;
  description: string;
  incidentDate: ISODate;
  orderRef: string;
  orderAmount: number;
  channel: ChannelType | 'other';
  evidence: MockDocument[];
  status: ComplaintStatus;
  createdAt: ISODate;
  updatedAt: ISODate;
  firstMerchantResponseAt?: ISODate;
  resolvedAt?: ISODate;
  messages: CaseMessage[];
  offers: ResolutionOffer[];
  timeline: TimelineEvent[];
  screening: ScreeningResult;
  officerPriority?: Priority;
  escalationReason?: string;
  officerNote?: string;
}

// ----- คำเตือน / การแก้ไข -----
export type WarningKind = 'advisory' | 'warning';
export type WarningStatus =
  | 'advisory'
  | 'warning_issued'
  | 'acknowledged'
  | 'correction_required'
  | 'correction_submitted'
  | 'under_review'
  | 'completed';

export interface CorrectiveItem {
  id: string;
  text: string;
  done: boolean;
}

export interface WarningRecord {
  id: string;
  merchantId: string;
  kind: WarningKind;
  status: WarningStatus;
  title: string;
  issue: string;
  guidance: string;
  items: CorrectiveItem[];
  courseIds: string[];
  dueDate: ISODate;
  evidence: MockDocument[];
  merchantNote?: string;
  officerId: string;
  relatedComplaintIds: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
  timeline: TimelineEvent[];
}

// ----- ความเสี่ยง / ระงับ / อุทธรณ์ -----
export type RiskCaseStatus = Exclude<RiskStatus, 'none'> | 'dismissed';

export interface RiskCase {
  id: string;
  merchantId: string;
  status: RiskCaseStatus;
  reason: string;
  evidenceSummary: string[];
  relatedComplaintIds: string[];
  merchantStatement?: string;
  appeal?: { text: string; submittedAt: ISODate; result?: 'upheld' | 'overturned'; resultNote?: string };
  createdAt: ISODate;
  updatedAt: ISODate;
  timeline: TimelineEvent[];
}

// ----- การอบรม -----
export interface Lesson {
  id: string;
  title: string;
  body: string[];
}
export interface QuizQuestion {
  id: string;
  q: string;
  options: string[];
  answer: number;
}
export interface Course {
  id: string;
  code: string;
  title: string;
  summary: string;
  durationMin: number;
  lessons: Lesson[];
  quiz: QuizQuestion[];
  passScore: number; // %
}
export interface Enrollment {
  id: string;
  operatorId: string;
  courseId: string;
  completedLessonIds: string[];
  attempts: number;
  bestScore?: number;
  passed: boolean;
  startedAt: ISODate;
  completedAt?: ISODate;
  certificateNo?: string;
}

// ----- ผู้ใช้อื่น -----
export interface Consumer {
  id: string;
  name: string;
  phone: string;
  email: string;
  province: string;
}
export interface Officer {
  id: string;
  name: string;
  position: string;
  role: 'officer' | 'admin';
}

// ----- การแจ้งเตือน / Audit -----
export interface AppNotification {
  id: string;
  recipientRole: Role;
  /** operatorId / consumerId / officerId; ว่าง = ทุกคนใน role นั้น */
  recipientId?: string;
  title: string;
  body: string;
  link?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: ISODate;
}

export interface AuditEntry {
  id: string;
  at: ISODate;
  actorRole: Role | 'system';
  actorName: string;
  action: string;
  target: string;
  detail?: string;
}
