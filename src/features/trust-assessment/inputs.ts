/** สร้าง Input ของ Engine จากข้อมูลชุดใดก็ได้ (Store จริง หรือ Seed) — ใช้ร่วมกันทั้งแอปและ Test */
import type { Certification, Complaint, Enrollment, Merchant, Operator, RiskCase, WarningRecord } from '@/types';
import type { MarketplaceConnection } from '@/features/marketplace/types';
import { snapshotOf } from '@/features/marketplace/services/generator';
import { hashString } from '@/features/marketplace/services/prng';
import { currentCert, effectiveLevel } from '@/utils/trust';
import type { AssessmentInput } from './types';
import type { Weights } from './model';

export interface DataBundle {
  operators: Operator[];
  merchants: Merchant[];
  certifications: Certification[];
  complaints: Complaint[];
  warnings: WarningRecord[];
  risks: RiskCase[];
  enrollments: Enrollment[];
  connections: MarketplaceConnection[];
}

/** เฉพาะการเชื่อมต่อที่ซิงก์สำเร็จแล้วเท่านั้นที่ใช้ประเมิน */
export const usableConnections = (connections: MarketplaceConnection[], merchantId: string) =>
  connections.filter((c) => c.merchantId === merchantId && c.status === 'connected' && !!c.lastSyncAt);

export function buildAssessmentInput(merchantId: string, data: DataBundle, asOf: Date = new Date()): AssessmentInput | undefined {
  const merchant = data.merchants.find((m) => m.id === merchantId);
  if (!merchant) return undefined;
  const operator = data.operators.find((o) => o.id === merchant.operatorId);
  const cert = currentCert(data.certifications, merchantId);
  return {
    merchant,
    operator,
    cert,
    currentLevel: effectiveLevel(operator, cert),
    complaints: data.complaints,
    warnings: data.warnings,
    risks: data.risks,
    enrollments: data.enrollments,
    marketplace: usableConnections(data.connections, merchantId).map((connection) => ({ connection, snapshot: snapshotOf(connection, merchant.category) })),
    asOf,
  };
}

/** ลายนิ้วมือของข้อมูลที่ใช้ประเมิน — เปลี่ยนเมื่อข้อมูลหรือน้ำหนักเปลี่ยน (ใช้แจ้ง "ผลประเมินล้าสมัย") */
export function inputsKey(input: AssessmentInput, weights: Weights): string {
  const m = input.merchant;
  const mine = <T extends { merchantId: string }>(xs: T[]) => xs.filter((x) => x.merchantId === m.id);
  const parts = {
    w: weights,
    kyc: input.operator?.kycStatus,
    reg: m.registrationStatus,
    risk: m.riskStatus,
    ch: m.channels.map((c) => `${c.id}:${c.status}`),
    cert: input.cert ? `${input.cert.id}:${input.cert.status}` : '',
    cmp: mine(input.complaints).map((c) => `${c.id}:${c.status}`),
    wrn: mine(input.warnings).map((w) => `${w.id}:${w.status}`),
    rsk: mine(input.risks).map((r) => `${r.id}:${r.status}`),
    trn: input.enrollments.filter((e) => e.operatorId === m.operatorId && e.passed).length,
    mkt: input.marketplace.map((x) => `${x.connection.id}:${x.connection.lastSyncAt}:${x.connection.archetype}`),
  };
  return hashString(JSON.stringify(parts)).toString(36);
}
