import type { Certification, Complaint, Enrollment, ISODate, Merchant, Operator, RiskCase, WarningRecord } from '@/types';
import type { MarketplaceConnection, MarketplaceSnapshot, Platform } from '@/features/marketplace/types';
import type { PriceAnalysis, ReviewAnalysis, SalesAnalysis } from '@/features/marketplace/analysis/types';
import type { ComponentId, Weights } from './model';

export type Band = 'A' | 'B' | 'C' | 'D';
export type BandOrInsufficient = Band | 'insufficient';
/** สถานะการรับรองจาก v1 — แยกจาก Band เสมอ (D8) */
export type Standing = 'normal' | 'under_review' | 'suspended' | 'revoked';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type FactorSource = 'identity' | 'shopee' | 'lazada' | 'marketplace' | 'complaints' | 'warnings' | 'training' | 'risk';

export interface TrustFactor {
  id: string;
  component: ComponentId | 'risk';
  label: string;
  value: string;
  /** ผลต่อคะแนน: องค์ประกอบ C1–C5 = คะแนนภายในองค์ประกอบ (0–100) · risk = คะแนนที่หักจากคะแนนรวม */
  impact: number;
  direction: 'positive' | 'negative' | 'neutral';
  evidence: string[];
  source: FactorSource;
  improve?: string;
}

export interface ComponentResult {
  id: ComponentId;
  label: string;
  /** น้ำหนักที่ตั้งไว้ */
  weight: number;
  /** น้ำหนักหลังกระจายใหม่ (องค์ประกอบที่ไม่มีข้อมูลไม่ถูกนับ — D6) */
  effectiveWeight: number;
  available: boolean;
  score: number | null;
  /** score × effectiveWeight ÷ 100 */
  contribution: number;
  factors: TrustFactor[];
}

export interface CoverageItem {
  key: string;
  label: string;
  have: number;
  target: number;
  ratio: number;
  weight: number;
}

export type Recommendation =
  | { kind: 'blocked'; reasons: string[] }
  | { kind: 'need_more_data'; reasons: string[] }
  | { kind: 'refer_risk'; reasons: string[] }
  | { kind: 'consider_l3' | 'consider_l4'; level: 3 | 4; reasons: string[] }
  | { kind: 'not_yet'; reasons: string[] };

export interface AssessmentResult {
  modelVersion: string;
  weights: Weights;
  computedAt: ISODate;
  /** คะแนน 0–100 — แสดงเฉพาะเจ้าหน้าที่/ผู้ดูแลระบบ (D2) */
  score: number;
  baseScore: number;
  riskPenalty: number;
  components: ComponentResult[];
  riskFactors: TrustFactor[];
  band: BandOrInsufficient;
  /** Band ที่ได้จากคะแนน (ใช้แสดงให้เจ้าหน้าที่แม้ข้อมูลไม่พอ) */
  scoreBand: Band;
  insufficientReasons: string[];
  standing: Standing;
  standingReason?: string;
  coverage: { percent: number; items: CoverageItem[] };
  confidence: { level: ConfidenceLevel; score: number; reasons: string[] };
  recommendation: Recommendation;
  /** สรุปสำหรับผู้บริโภค — ไม่มีตัวเลขคะแนน ยอดขาย หรือข้อกล่าวหาที่ยังไม่มีข้อสรุป */
  publicSummary: string[];
  dataSources: Platform[];
  monthsOfData: number;
  analysis: { price: PriceAnalysis; sales: SalesAnalysis; reviews: ReviewAnalysis };
}

export interface AssessmentInput {
  merchant: Merchant;
  operator?: Operator;
  cert?: Certification;
  /** ระดับ Trust ที่ใช้ได้ตอนนี้ (v1) */
  currentLevel: number;
  complaints: Complaint[];
  warnings: WarningRecord[];
  risks: RiskCase[];
  enrollments: Enrollment[];
  marketplace: { connection: MarketplaceConnection; snapshot: MarketplaceSnapshot }[];
  asOf: Date;
}

export type AssessmentStatus = 'draft' | 'pending_review' | 'decided';
export type OfficerDecisionKind = 'approved' | 'need_info' | 'rejected' | 'escalated';

export interface TrustAssessment {
  id: string;
  merchantId: string;
  createdAt: ISODate;
  status: AssessmentStatus;
  /** ใช้ตรวจว่าข้อมูลเปลี่ยนหลังประเมินหรือไม่ */
  inputsKey: string;
  result: AssessmentResult;
  submittedAt?: ISODate;
  /** คำขอ (v1) ที่ผูกกับผลประเมินตอนส่งพิจารณา — คำขอรับรอง Level 3–4 หรือคำขอลงทะเบียนที่ยังค้างอยู่ */
  applicationId?: string;
  decision?: {
    kind: OfficerDecisionKind;
    level?: 3 | 4;
    reason: string;
    officerId: string;
    officerName: string;
    at: ISODate;
    /** ต่างจากข้อเสนอของระบบหรือไม่ */
    overridesRecommendation: boolean;
    applicationId?: string;
    certId?: string;
    riskCaseId?: string;
  };
}
