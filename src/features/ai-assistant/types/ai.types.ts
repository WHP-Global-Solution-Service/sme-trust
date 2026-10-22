/**
 * AI Simulation — ชนิดข้อมูลของระบบวิเคราะห์แบบ Rule-based
 * ไม่ใช่ AI Model จริง: ทุกผลลัพธ์มาจากกฎที่กำหนดไว้ล่วงหน้าและทำงานในเบราว์เซอร์เท่านั้น
 */

// ---------------- AI-01 Advertising Compliance Checker ----------------
export type AdRuleCategory = 'health' | 'absolute' | 'superiority' | 'promotion' | 'urgency' | 'missing';
export type Severity = 'low' | 'medium' | 'high';
export type AdRiskLevel = 'low' | 'medium' | 'high';

export interface AdRule {
  id: string;
  category: AdRuleCategory;
  label: string;
  severity: Severity;
  /** รูปแบบข้อความที่ตรวจจับ (รองรับไทย/อังกฤษ) */
  patterns: RegExp[];
  explanation: string;
  why: string;
  suggestion: string;
  /** ข้อความที่ใช้แทนในฉบับเสนอแก้ไข (undefined = คงข้อความเดิม, '' = ตัดออก) */
  replacement?: string;
}

export interface TextMatch {
  start: number;
  end: number;
  text: string;
}

export interface AdFinding {
  ruleId: string;
  category: AdRuleCategory;
  label: string;
  severity: Severity;
  /** ข้อความที่ตรวจพบ (ไม่ซ้ำ) */
  matched: string[];
  /** ตำแหน่งในข้อความต้นฉบับ (ใช้ทำ Highlight) — ว่างได้สำหรับกฎ "ข้อมูลที่ขาด" */
  matches: TextMatch[];
  occurrences: number;
  explanation: string;
  why: string;
  suggestion: string;
}

export interface AdAnalysis {
  input: string;
  level: AdRiskLevel;
  score: number;
  findings: AdFinding[];
  /** ข้อความฉบับเสนอแก้ไข — null เมื่อไม่มีข้อเสนอ หรือสร้างฉบับที่น่าเชื่อถือไม่ได้ */
  revision: string | null;
  /** เมื่อแก้ไขอัตโนมัติไม่เหมาะสม ให้แสดงคำแนะนำเป็นรายการแทน */
  revisionNote?: string;
  checkedAt: string;
}

export interface Segment {
  text: string;
  findingIds: string[];
}

// ---------------- AI-02 Complaint Resolution Assistant ----------------
export type ComplaintKind = 'non_delivery' | 'mismatch' | 'damaged' | 'refund' | 'delay' | 'service' | 'other';
export type FollowUpLevel = 'normal' | 'attention' | 'urgent';

export interface ExtractedFacts {
  orderRef?: string;
  amount?: string;
  date?: string;
  mentionsPayment: boolean;
  mentionsPhoto: boolean;
  mentionsTracking: boolean;
}

export interface ComplaintAnalysis {
  input: string;
  primary: ComplaintKind;
  kinds: ComplaintKind[];
  keyIssues: string[];
  facts: ExtractedFacts;
  /** ข้อมูลที่ควรขอเพิ่มเติม (เฉพาะที่เกี่ยวกับประเภทเคส และยังไม่พบในข้อความ) */
  missing: string[];
  level: FollowUpLevel;
  levelReasons: string[];
  recommendations: string[];
  /** แนะนำให้เจ้าหน้าที่ตรวจสอบโดยเร็ว (กรณีบ่งชี้การหลอกลวงร้ายแรงหรืออันตราย) */
  officerReviewSuggested: boolean;
  checkedAt: string;
}

export type DraftTone = 'formal' | 'friendly' | 'concise';
export type Particle = 'ค่ะ' | 'ครับ' | 'ค่ะ/ครับ';

export interface DraftContext {
  caseId?: string;
  /** สิ่งที่ร้านค้าเสนอไว้แล้วในระบบ (ยืนยันจาก Mock Workflow เท่านั้น) */
  confirmedOffers?: string[];
}

// ---------------- History ----------------
export interface AiHistoryEntry {
  id: string;
  type: 'advertising' | 'complaint';
  /** ชื่อตัวอย่าง / Case ID — ไม่บันทึกข้อความที่ผู้ใช้พิมพ์เอง */
  source: string;
  resultCategory: string;
  level: string;
  createdAt: string;
}
