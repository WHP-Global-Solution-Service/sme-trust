import type { Role } from '@/types';
import type { DemoCtx } from '@/stores/demo';

/** ข้อมูลที่ใช้ตรวจเงื่อนไขของขั้นตอน (อ่านอย่างเดียว) */
export interface GateInput {
  ctx: DemoCtx;
  startedAt: string;
  signals: Record<string, string | number | boolean>;
  session: { role: Role; operatorId: string; merchantLoggedIn: boolean };
}

export interface DemoStep {
  id: string;
  title: string;
  instruction: string | ((ctx: DemoCtx) => string);
  tip?: string;
  role: Role;
  route: (ctx: DemoCtx) => string;
  /** เหตุผลของการเปลี่ยนบทบาท เมื่อเข้าสู่ขั้นนี้จากบทบาทอื่น (แสดงใน Role Transition) */
  transition?: string;
  /** ป้ายปุ่มถัดไป (CTA) เมื่ออยู่ที่ขั้นนี้ */
  nextLabel?: string;
  /** เงื่อนไขที่ต้องผ่านก่อนกดถัดไป — ไม่มี = ขั้นอธิบาย/ดูข้อมูล */
  gate?: { check: (g: GateInput) => boolean; hint: string };
  /** บันทึก IDs ที่เกิดจากขั้นนี้ลงบริบท (ทำเมื่อกดถัดไป) */
  capture?: (g: GateInput) => Partial<DemoCtx>;
}

/** ข้อมูลจาก Scenario ก่อนหน้าใช้ต่อไม่ได้ — ต้องให้ผู้ใช้เลือกว่าจะย้อนกลับไปทำให้ครบ หรือใช้ข้อมูลตัวอย่าง */
export interface ContinuityIssue {
  /** สาเหตุ เช่น ร้านจาก Scenario 2 ยังไม่ได้รับการรับรอง */
  message: string;
  /** Scenario ที่ต้องย้อนกลับไปทำให้ครบ */
  fixScenario: string;
  /** ข้อมูลตัวอย่างที่จะใช้แทน */
  fallbackLabel: string;
}

export type Track = 'v1' | 'v2';

export interface ScenarioDef {
  id: string;
  no: number;
  /** v1 = Consumer Protection (Scenario 1–8) · v2 = Marketplace Intelligence (Scenario 9–13) — ไม่ระบุ = v1 */
  track?: Track;
  /** รหัสที่แสดง เช่น "9B" — ไม่ระบุใช้เลข Scenario */
  code?: string;
  /** เส้นทางทางเลือก (Branch) — ไม่อยู่ในลำดับของ Full Journey */
  branch?: boolean;
  title: string;
  objective: string;
  keyMessage: string;
  audience: Role[];
  duration: string;
  benefits: { sme: string; consumer: string; ocpb: string };
  /** อธิบายว่าเป็นคนละเหตุการณ์ (กรณีศึกษาแยก) */
  caseNote?: string;
  nextCta?: string;
  /** เตรียมบริบท/Fixture — carry = ต่อจาก Scenario ก่อนหน้าโดยไม่ Reset ทั้งระบบ */
  prepare: (journey: DemoCtx, carry: boolean) => DemoCtx;
  /** ข้อมูลจากการเล่นครั้งก่อนที่จะถูกล้างเมื่อเริ่มใหม่ (แจ้งผู้ใช้ก่อนเริ่ม) — undefined = ไม่มี */
  replayNote?: () => string | undefined;
  /** ตรวจว่าข้อมูลที่ส่งต่อมาใช้ได้หรือไม่ (เฉพาะการเล่นต่อเนื่อง) — ถ้าไม่ได้ prepare จะใช้ข้อมูลตัวอย่าง */
  continuity?: (journey: DemoCtx) => ContinuityIssue | undefined;
  /** IDs ที่ส่งต่อให้ Scenario ถัดไป */
  exports?: (ctx: DemoCtx) => Partial<DemoCtx>;
  steps: DemoStep[];
  /** สรุปสิ่งที่เปลี่ยนแปลงใน Mock State (คำนวณจากข้อมูลจริง) */
  summary: (ctx: DemoCtx) => string[];
  /** ผลลัพธ์ที่แตกแขนงตามการตัดสินจริง (เช่น อนุมัติ / ขอข้อมูลเพิ่ม / ไม่อนุมัติ) — ใช้แสดงหน้าจบ Scenario ให้ตรงกับผลจริง */
  outcome?: (ctx: DemoCtx) => ScenarioOutcome | undefined;
}

export interface ScenarioOutcome {
  kind: 'approved' | 'need_info' | 'rejected' | 'escalated' | 'insufficient' | 'pending';
  tone: 'success' | 'warning' | 'error' | 'info';
  title: string;
  /** สิ่งที่เกิดขึ้นจริงกับร้าน คำขอ และใบรับรอง */
  facts: string[];
  /** ผลต่อสิ่งที่ผู้บริโภคเห็น */
  consumerView: string;
  /** คำแนะนำขั้นต่อไปตามผลลัพธ์ */
  next: string;
}
