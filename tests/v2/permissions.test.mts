// Role & Permission — ตาราง Matrix ตรงกับการบังคับสิทธิ์จริง (RoleGate + authorize) · Public projection ไม่มีคะแนนตัวเลข
import { readFileSync } from 'node:fs';
import { S, W, view, describe, check, finish } from '../harness.mts';

const P = await import('@/auth/permissions');
const AZ = await import('@/auth/authorize');
const V2 = await import('@/stores/workflowsV2');
const AU = await import('@/stores/automation');
const PV = await import('@/features/trust-assessment/publicView');

type Role = 'consumer' | 'merchant' | 'officer' | 'admin';
const SESSION: Record<Role, Record<string, unknown> & { role: Role }> = {
  consumer: { role: 'consumer', consumerId: 'CS-001' },
  merchant: { role: 'merchant', operatorId: 'OP-001', activeMerchantId: 'M-001' },
  officer: { role: 'officer', officerId: 'OF-001' },
  admin: { role: 'admin', officerId: 'AD-001' },
};
/** ข้อความเฉพาะของ RoleGate — แยกจากการจำกัดสิทธิ์รายเรื่อง (เช่น เรื่องร้องเรียนของบัญชีอื่น) */
const GATE_DENIED = 'คุณกำลังใช้มุมมอง';
const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
const as = (role: Role) => S.useSessionStore.setState({ merchantLoggedIn: true, ...SESSION[role] });

/** เรียกฟังก์ชันในบทบาทที่กำหนด → 'denied' | 'allowed' (allowed = ผ่านการตรวจสิทธิ์ แม้ผลทางธุรกิจจะไม่สำเร็จ) */
function attempt(role: Role, fn: () => unknown): 'denied' | 'allowed' {
  const keep = S.useSessionStore.getState();
  as(role);
  try {
    fn();
    return 'allowed';
  } catch (e) {
    if (e instanceof AZ.PermissionDeniedError) return 'denied';
    return 'allowed'; // ผ่าน authorize แล้ว — ล้มเหลวด้วยเหตุผลทางธุรกิจ (เช่น ไม่พบรายการ)
  } finally {
    S.useSessionStore.setState({ role: keep.role, operatorId: keep.operatorId, consumerId: keep.consumerId, officerId: keep.officerId, activeMerchantId: keep.activeMerchantId });
  }
}

// ---------------------------------------------------------------------------
describe('บทบาทในระบบ — ตรงกับ type Role จริง');
{
  const types = src('types/index.ts');
  check(/export type Role = 'merchant' \| 'consumer' \| 'officer' \| 'admin';/.test(types), 'type Role มี 4 บทบาท: merchant / consumer / officer / admin');
  check(P.ROLES.length === 4 && P.ROLES.every((r) => ['merchant', 'consumer', 'officer', 'admin'].includes(r)), 'Matrix ใช้ 4 บทบาทเดียวกัน (ไม่มี Supervisor/Approver/Auditor)');
}

// ---------------------------------------------------------------------------
describe('Matrix ↔ เส้นทางใน AppRoutes (ทุกเส้นทางที่ตรวจสิทธิ์มีในตาราง และกลับกัน)');
{
  const routes = src('routes/AppRoutes.tsx');
  const gated = [...routes.matchAll(/path="([^"]+)" element=\{gate\(/g)].map((m) => m[1]);
  const publicPaths = ['/check', '/directory', '/shop/:id', '/verify', '/verify/:certId'];
  const inMatrix = new Set(P.permissionList().flatMap(([, d]) => d.routes));
  const missing = gated.filter((r) => !inMatrix.has(r));
  check(gated.length >= 60, `AppRoutes มีเส้นทางที่ตรวจสิทธิ์ ${gated.length} เส้นทาง`);
  check(missing.length === 0, `ทุกเส้นทางที่ตรวจสิทธิ์อยู่ใน Matrix${missing.length ? ` — ขาด: ${missing.join(', ')}` : ''}`);
  const unknown = [...inMatrix].filter((r) => !gated.includes(r) && !publicPaths.includes(r));
  check(unknown.length === 0, `ทุกเส้นทางใน Matrix มีอยู่จริง${unknown.length ? ` — ไม่พบ: ${unknown.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------------
describe('Matrix ↔ RoleGate: Render ทุกเส้นทาง × ทุกบทบาท แล้วผลต้องตรงกับตาราง');
{
  let mismatches: string[] = [];
  let n = 0;
  for (const [key, def] of P.permissionList()) {
    for (const route of def.routes) {
      const url = route.replace(/:[a-zA-Z]+/g, 'X-TEST');
      for (const role of P.ROLES) {
        const denied = view(url, SESSION[role]).includes(GATE_DENIED);
        n++;
        if (denied === P.can(role, key)) mismatches.push(`${route} [${role}] ${denied ? 'ถูกปฏิเสธ' : 'เข้าได้'} แต่ตาราง ${P.can(role, key) ? '✓' : '✗'}`);
      }
    }
  }
  check(mismatches.length === 0, `${n} กรณี (เส้นทาง × บทบาท) ตรงกับ Matrix${mismatches.length ? `\n      ${mismatches.slice(0, 8).join('\n      ')}` : ''}`);
}

// ---------------------------------------------------------------------------
describe('Matrix ↔ authorize(): ฟังก์ชันที่ระบุว่า guarded เรียก authorize ด้วยสิทธิ์เดียวกันจริง');
{
  const files = ['stores/workflows.ts', 'stores/workflowsV2.ts', 'stores/automation.ts', 'stores/assessmentConfig.ts'].map(src).join('\n');
  const bad: string[] = [];
  let guarded = 0;
  for (const [key, def] of P.permissionList()) {
    for (const a of (def.actions ?? []).filter((x) => x.guarded)) {
      guarded++;
      const name = a.name.replace(/\(.*$/, '');
      const by = a.name.match(/by: '(\w+)'/)?.[1];
      const origin = a.name.match(/origin: '(\w+)'/)?.[1];
      const re =
        origin
          ? new RegExp(`export function ${name}\\([^\\n]*\\{\\s*if \\(origin === '${origin}'\\) authorize\\('${key}'\\)`)
          : name === 'setWeights'
          ? new RegExp(`setWeights: \\(w\\) => \\{\\s*authorize\\('${key}'\\)`)
          : by
            ? new RegExp(`export function ${name}\\([^\\n]*\\{\\s*(?:if \\(by === '\\w+'\\) authorize\\('[\\w.]+'\\);\\s*else )?if \\(by === '${by}'\\) authorize\\('${key}'\\)|by === '${by}'\\) authorize\\('${key}'\\)`)
            : new RegExp(`export function ${name}\\([^\\n]*\\{\\s*authorize\\('${key}'\\)`);
      if (!re.test(files)) bad.push(`${a.name} → ${key}`);
    }
  }
  check(guarded >= 50, `ฟังก์ชันที่บังคับสิทธิ์ ${guarded} รายการ`);
  check(bad.length === 0, `ทุกฟังก์ชัน guarded ใน Matrix เรียก authorize('<สิทธิ์>') เป็นบรรทัดแรก${bad.length ? ` — ไม่ตรง: ${bad.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------------
describe('ไม่มี Store Action ที่ยังไม่ได้จัดประเภท — ทุกฟังก์ชันที่ export อยู่ใน Matrix หรือรายการ "ไม่ตรวจบทบาทโดยเจตนา"');
{
  const inMatrix = new Set(P.permissionList().flatMap(([, d]) => (d.actions ?? []).map((a) => a.name.replace(/\(.*$/, ''))));
  const exported = ['stores/workflows.ts', 'stores/workflowsV2.ts', 'stores/automation.ts'].flatMap((f) => [...src(f).matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]));
  check(exported.length >= 70, `พบฟังก์ชันที่ export จาก Store ${exported.length} รายการ`);
  const unclassified = exported.filter((n) => !inMatrix.has(n) && !(n in P.UNGUARDED_BY_DESIGN));
  check(unclassified.length === 0, `ทุกฟังก์ชันถูกจัดประเภท${unclassified.length ? ` — ยังไม่จัด: ${unclassified.join(', ')}` : ''}`);
  const both = Object.keys(P.UNGUARDED_BY_DESIGN).filter((n) => inMatrix.has(n) && n !== 'resetAllDemoData');
  check(both.length === 0, `ไม่มีฟังก์ชันที่อยู่ทั้งใน Matrix และรายการไม่ตรวจบทบาท${both.length ? ` — ${both.join(', ')}` : ''}`);
  const stale = Object.keys(P.UNGUARDED_BY_DESIGN).filter((n) => !exported.includes(n));
  check(stale.length === 0, `รายการไม่ตรวจบทบาทไม่มีชื่อที่ไม่มีอยู่จริง${stale.length ? ` — ${stale.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------------
describe('Action ของผู้ประกอบการ: บทบาทอื่นเรียกไม่ได้ · ข้อมูลไม่เปลี่ยน · บันทึก Audit');
{
  const WF = W as unknown as Record<string, (...a: unknown[]) => unknown>;
  const V = V2 as unknown as Record<string, (...a: unknown[]) => unknown>;
  const A = AU as unknown as Record<string, (...a: unknown[]) => unknown>;
  const snapshot = () =>
    JSON.stringify(
      [S.useVerificationStore, S.useMerchantStore, S.useMarketplaceStore, S.useAssessmentStore, S.useProfileChangeStore, S.useOfficerTaskStore, S.useTrainingStore, S.useWarningStore, S.useOperatorStore, S.useCertificationStore].map(
        (s) => (s.getState() as { items: unknown[] }).items,
      ),
    );
  const cases: [string, () => unknown][] = [
    ['submitShopRegistration', () => WF.submitShopRegistration('OP-001', {} as never)],
    ['submitMarketplaceRegistration', () => V.submitMarketplaceRegistration('OP-001', {} as never, { draftId: 'x' } as never)],
    ['resubmitApplication', () => WF.resubmitApplication('APP-001', 'note', [])],
    ['addChannel', () => WF.addChannel('M-001', 'facebook', 'x')],
    ['applyCertification', () => WF.applyCertification('M-001', 3)],
    ['toggleWarningItem', () => WF.toggleWarningItem('WRN-001', 'i1')],
    ['connectMarketplace', () => V.connectMarketplace('M-001', 'shopee')],
    ['grantConsent', () => V.grantConsent('MKC-001')],
    ['resyncMarketplace', () => V.resyncMarketplace('MKC-001')],
    ['disconnectMarketplace', () => V.disconnectMarketplace('MKC-001')],
    ['confirmProfileUpdate', () => V.confirmProfileUpdate('MKC-001', {} as never, 'd')],
    ['resubmitProfileChange', () => V.resubmitProfileChange('PCR-001', {}, 'note')],
    ["runAssessment(origin: 'merchant')", () => V.runAssessment('M-001')],
    ['submitAssessment', () => V.submitAssessment('TAS-001')],
    ['respondToTask', () => A.respondToTask('TSK-001', 'ข้อมูลเพิ่มเติม')],
    ['startCourse', () => WF.startCourse('OP-001', 'C-001')],
    ['completeLesson', () => WF.completeLesson('OP-001', 'C-001', 'L-001')],
    ['submitQuiz', () => WF.submitQuiz('OP-001', 'C-001', [0])],
  ];
  for (const [name, fn] of cases) {
    for (const role of ['consumer', 'officer', 'admin'] as Role[]) {
      const before = snapshot();
      const audits = S.useAuditStore.getState().items.length;
      const r = attempt(role, fn);
      const last = S.useAuditStore.getState().items[0];
      check(
        r === 'denied' && snapshot() === before && S.useAuditStore.getState().items.length === audits + 1 && last?.actorRole === role && /Permission Denied/.test(last.action),
        `${role} เรียก ${name} → ถูกปฏิเสธ ข้อมูลไม่เปลี่ยน และบันทึก Audit`,
      );
    }
  }
  // ระบบอัตโนมัติยังประเมินใหม่ได้ (origin: automation ไม่ใช่การกระทำของผู้ใช้)
  check(attempt('consumer', () => V.runAssessment('M-001', 'automation')) === 'allowed', "runAssessment(origin: 'automation') ไม่ถูกบล็อกตามบทบาท (ระบบเป็นผู้ประเมิน)");
  // เจ้าหน้าที่ยังยื่นคำขอรับรองผ่าน decideAssessment ได้ (ใช้ fileCertificationApplication ภายใน)
  const v2src = src('stores/workflowsV2.ts');
  check(/fileCertificationApplication\(a\.merchantId, level\)/.test(v2src) && !/[^.\w]applyCertification\(/.test(v2src), 'decideAssessment / submitAssessment ใช้ fileCertificationApplication ภายใน ไม่เรียก applyCertification ที่ตรวจสิทธิ์ผู้ประกอบการ');
}

// ---------------------------------------------------------------------------
describe('Error และ Audit ไม่เปิดเผยข้อมูลภายใน · สลับบทบาทแล้วสิทธิ์เดิมไม่ค้าง');
{
  const keep = S.useSessionStore.getState().role;
  as('consumer');
  let err: unknown;
  try {
    W.approveApplication('APP-001');
  } catch (e) {
    err = e;
  }
  const msg = err instanceof Error ? err.message : '';
  const last = S.useAuditStore.getState().items[0];
  check(err instanceof AZ.PermissionDeniedError, 'ปฏิเสธด้วย PermissionDeniedError');
  check(!!msg && !/APP-|M-\d|OP-\d|score|คะแนน|\.ts\b|stack|application\.review/i.test(msg) && (err as InstanceType<typeof AZ.PermissionDeniedError>).permission === 'application.review', `ข้อความ Error ไม่มีรหัสรายการ คะแนน หรือ Stack/ไฟล์ภายใน ("${msg}")`);
  check(!!last && !/APP-001|score|คะแนน|PIN|demoPin|\d{13}/.test(`${last.target} ${last.detail ?? ''}`), 'Audit ของการปฏิเสธบันทึกเฉพาะบทบาทและสิทธิ์ ไม่บันทึกรหัสรายการ คะแนน PIN หรือเลขประจำตัว');
  // สลับบทบาท: เจ้าหน้าที่ → ผู้บริโภค แล้วสิทธิ์เจ้าหน้าที่ต้องหายทันที (ตรวจจากบทบาทปัจจุบันทุกครั้ง ไม่ Cache)
  check(attempt('officer', () => W.setCheck('APP-001', 'x', 'pass')) === 'allowed', 'เจ้าหน้าที่เรียก setCheck ได้');
  as('officer');
  S.useSessionStore.getState().switchRole('consumer');
  let denied = false;
  try {
    W.setCheck('APP-001', 'x', 'pass');
  } catch (e) {
    denied = e instanceof AZ.PermissionDeniedError;
  }
  check(denied, 'สลับจากเจ้าหน้าที่เป็นผู้บริโภคด้วย switchRole แล้ว setCheck ถูกปฏิเสธทันที (ไม่มีสิทธิ์ค้าง)');
  S.useSessionStore.getState().switchRole('merchant');
  denied = false;
  try {
    W.approveApplication('APP-001');
  } catch (e) {
    denied = e instanceof AZ.PermissionDeniedError;
  }
  check(denied, 'สลับเป็นผู้ประกอบการแล้ว approveApplication ถูกปฏิเสธ');
  S.useSessionStore.setState({ role: keep });
}

// ---------------------------------------------------------------------------
describe('ผู้บริโภคเข้าหน้าเจ้าหน้าที่ / ผู้ดูแลระบบไม่ได้');
for (const url of ['/o', '/o/assessments', '/o/profile-changes', '/o/complaints', '/admin', '/admin/permissions', '/admin/audit']) {
  check(view(url, SESSION.consumer).includes(GATE_DENIED), `ผู้บริโภค → ${url} ถูกปฏิเสธ`);
}

describe('ผู้ดูแลระบบเข้าหน้า Role & Permission ได้ · บทบาทอื่นไม่ได้');
{
  const page = view('/admin/permissions', SESSION.admin);
  check(page.includes('Role & Permission Matrix') && !page.includes(GATE_DENIED), 'ผู้ดูแลระบบเปิด /admin/permissions ได้');
  const keys = P.permissionList().map(([k]) => k);
  check(keys.every((k) => page.includes(k)), `หน้า Matrix แสดงสิทธิ์ครบ ${keys.length} รายการ`);
  check(page.includes('อ่านอย่างเดียว') && page.includes('ยังไม่มีในระบบต้นแบบ'), 'ระบุว่าเป็นตารางอ่านอย่างเดียว และแสดงสิ่งที่ระบบยังไม่มี');
  for (const r of ['officer', 'merchant', 'consumer'] as Role[]) check(view('/admin/permissions', SESSION[r]).includes(GATE_DENIED), `${r} → /admin/permissions ถูกปฏิเสธ`);
}

// ---------------------------------------------------------------------------
describe('ร้านค้า (Shop Owner) อนุมัติ / ตัดสินไม่ได้ — รวมถึงร้านของตนเอง');
{
  const app = S.useVerificationStore.getState().items.find((a) => a.status !== 'approved' && a.status !== 'rejected')!;
  const before = JSON.stringify(app);
  const auditBefore = S.useAuditStore.getState().items.length;
  check(attempt('merchant', () => W.approveApplication(app.id)) === 'denied', `merchant → approveApplication(${app.id}) ถูกปฏิเสธ`);
  check(JSON.stringify(S.useVerificationStore.getState().items.find((a) => a.id === app.id)) === before, '  คำขอไม่ถูกเปลี่ยนแปลง');
  const denied = S.useAuditStore.getState().items.find((a) => a.target === 'application.review' && a.action.includes('Permission Denied'));
  check(S.useAuditStore.getState().items.length === auditBefore + 1 && denied?.actorRole === 'merchant', '  บันทึกการปฏิเสธลง Audit Log (actorRole = merchant)');
  check(attempt('merchant', () => W.rejectApplication(app.id, 'ทดสอบสิทธิ์')) === 'denied', 'merchant → rejectApplication ถูกปฏิเสธ');
  check(attempt('merchant', () => W.setCertStatus('CERT-X', 'active', 'x')) === 'denied', 'merchant → setCertStatus ถูกปฏิเสธ');
  check(attempt('merchant', () => V2.decideAssessment('TA-X', 'approved', 'ทดสอบสิทธิ์', 3)) === 'denied', 'merchant → decideAssessment ถูกปฏิเสธ');
  check(attempt('merchant', () => AU.resolveTask('TASK-X', 'approve', 'ทดสอบสิทธิ์')) === 'denied', 'merchant → resolveTask ถูกปฏิเสธ');
  check(attempt('merchant', () => W.riskAction('RC-X', 'dismissed', 'x')) === 'denied', 'merchant → riskAction ถูกปฏิเสธ');
  check(attempt('consumer', () => W.approveApplication(app.id)) === 'denied', 'consumer → approveApplication ถูกปฏิเสธ');
  check(attempt('officer', () => W.approveApplication(app.id)) === 'allowed', 'officer → approveApplication ผ่านการตรวจสิทธิ์');
}

describe('การอนุมัติคำขอเปลี่ยนข้อมูลร้าน — จำกัดเฉพาะเจ้าหน้าที่ / ผู้ดูแลระบบ');
for (const [fn, call] of [
  ['approveProfileChange', () => V2.approveProfileChange('PCR-X')],
  ['rejectProfileChange', () => V2.rejectProfileChange('PCR-X', 'ทดสอบสิทธิ์')],
  ['requestProfileChangeInfo', () => V2.requestProfileChangeInfo('PCR-X', 'ทดสอบสิทธิ์')],
] as const) {
  check(attempt('merchant', call) === 'denied' && attempt('consumer', call) === 'denied', `${fn}: merchant / consumer ถูกปฏิเสธ`);
  check(attempt('officer', call) === 'allowed' && attempt('admin', call) === 'allowed', `${fn}: officer / admin ผ่านการตรวจสิทธิ์`);
}

describe('ข้อร้องเรียน — แต่ละฝ่ายทำได้เฉพาะรายการของบทบาทตนเอง');
{
  const c = S.useComplaintStore.getState().items[0];
  const officerOnly = { officerClassify: () => W.officerClassify(c.id, 'other' as never, 'medium' as never, 'x'), officerRemand: () => W.officerRemand(c.id, 'x'), officerClose: () => W.officerClose(c.id, 'x'), "escalateComplaint(officer)": () => W.escalateComplaint(c.id, 'x', 'officer') };
  for (const [fn, call] of Object.entries(officerOnly)) check(attempt('consumer', call) === 'denied' && attempt('merchant', call) === 'denied', `${fn}: consumer / merchant ถูกปฏิเสธ`);
  check(attempt('merchant', () => W.submitComplaint({} as never)) === 'denied' && attempt('officer', () => W.submitComplaint({} as never)) === 'denied', 'submitComplaint: เฉพาะผู้บริโภค (merchant / officer ถูกปฏิเสธ)');
  check(attempt('consumer', () => W.merchantRespond(c.id, { type: 'explain', note: 'x' })) === 'denied' && attempt('officer', () => W.merchantRespond(c.id, { type: 'explain', note: 'x' })) === 'denied', 'merchantRespond: เฉพาะร้านค้า');
  check(attempt('merchant', () => W.consumerConfirmResolved(c.id)) === 'denied' && attempt('officer', () => W.consumerConfirmResolved(c.id)) === 'denied', 'consumerConfirmResolved: เฉพาะผู้บริโภค');
  const after = S.useComplaintStore.getState().items.find((x) => x.id === c.id)!;
  check(after.status === c.status && after.timeline.length === c.timeline.length, 'ความพยายามที่ถูกปฏิเสธไม่เปลี่ยนสถานะ / Timeline ของเรื่อง');
  const sys = S.useComplaintStore.getState().items.find((x) => x.id !== c.id && x.status !== 'escalated' && x.status !== 'closed')!;
  check(attempt('consumer', () => W.escalateComplaint(sys.id, 'ทดสอบงานอัตโนมัติ', 'system')) === 'allowed' && S.useComplaintStore.getState().items.find((x) => x.id === sys.id)!.status === 'escalated', "escalateComplaint(by: 'system') เป็นงานอัตโนมัติ — ไม่ผูกกับบทบาทผู้ใช้ และส่งต่อสำเร็จ");
}

describe('ปรับน้ำหนักโมเดล — เฉพาะผู้ดูแลระบบ');
{
  const cfg = await import('@/stores/assessmentConfig');
  const w = cfg.useAssessmentConfigStore.getState().weights;
  check(attempt('officer', () => cfg.useAssessmentConfigStore.getState().setWeights(w)) === 'denied', 'officer → setWeights ถูกปฏิเสธ');
  check(attempt('admin', () => cfg.useAssessmentConfigStore.getState().setWeights(w)) === 'allowed', 'admin → setWeights ผ่านการตรวจสิทธิ์');
}

// ---------------------------------------------------------------------------
describe('คะแนนตัวเลข: เจ้าหน้าที่เห็น · ผู้บริโภคและร้านค้าไม่เห็น');
{
  const a = V2.latestAssessment('M-001')!;
  const score = a.result.score.toFixed(1);
  const officerPage = view(`/o/assessments/${a.id}`, SESSION.officer);
  check(officerPage.includes(score) && officerPage.includes('คะแนนสุดท้าย'), `เจ้าหน้าที่เห็นคะแนน ${score} ในหน้าพิจารณาผลประเมิน`);
  check(view(`/o/assessments/${a.id}`, SESSION.admin).includes(score), 'ผู้ดูแลระบบเห็นคะแนน');
  const shop = view('/shop/M-001', SESSION.consumer);
  check(shop.includes(`Band ${a.result.band}`), `ผู้บริโภคเห็น Band ${a.result.band}`);
  check(!shop.includes(score) && !shop.includes('คะแนนสุดท้าย'), 'ผู้บริโภคไม่เห็นคะแนนตัวเลข');
  check(!shop.includes('(−'), 'ผู้บริโภคไม่เห็นเหตุผลของ Confidence ที่มีตัวเลขหักคะแนน/จำนวนคำสั่งซื้อ');
  check(a.result.confidence.reasons.every((r) => !shop.includes(r)), 'ผู้บริโภคไม่เห็นข้อความเหตุผลของ Confidence');
  check(a.result.riskFactors.every((f) => !shop.includes(f.label)), 'ผู้บริโภคไม่เห็นรายละเอียด Risk Signal');
  const mine = view('/m/trust', SESSION.merchant);
  check(!mine.includes(score) && !mine.includes('คะแนนสุดท้าย'), 'ร้านค้าไม่เห็นคะแนนตัวเลขของร้านตนเอง (เห็น Band ตามการออกแบบ D2)');
}

// ---------------------------------------------------------------------------
describe('ทุกหน้าของผู้บริโภคและร้านค้า (ทุกร้าน): ไม่มีคะแนนตัวเลข คะแนนที่หักภายใน หรือ Confidence ตัวเลข');
{
  AU.processAll('simulation');
  const merchants = S.useMerchantStore.getState().items;
  const assessments = S.useAssessmentStore.getState().items;
  const conns = S.useMarketplaceStore.getState().items;
  const complaints = S.useComplaintStore.getState().items;
  const fill = (r: string, mid: string) =>
    r
      .replace(':id', () => {
        if (r.startsWith('/m/marketplace')) return conns.find((x) => x.merchantId === mid)?.id ?? 'none';
        if (r.startsWith('/m/complaints')) return complaints.find((x) => x.merchantId === mid)?.id ?? 'none';
        if (r.startsWith('/shop')) return mid;
        return 'none';
      })
      .replace(':courseId', 'CRS-01')
      .replace(':certId', 'none');
  let pages = 0;
  const leaks: string[] = [];
  for (const m of merchants) {
    const scores = assessments.filter((a) => a.merchantId === m.id).map((a) => a.result.score.toFixed(1));
    const sessions = [
      { role: 'merchant' as Role, operatorId: m.operatorId, activeMerchantId: m.id },
      { role: 'consumer' as Role, consumerId: 'CS-001' },
    ];
    for (const s of sessions) {
      const routes = new Set(P.permissionList().filter(([, d]) => d.roles.includes(s.role)).flatMap(([, d]) => d.routes));
      for (const r of routes) {
        if (s.role === 'consumer' && r !== '/shop/:id' && r.includes(':')) continue;
        const url = fill(r, m.id);
        const html = view(url, s);
        pages++;
        const found = [
          ...scores.filter((sc) => html.includes(sc)).map((sc) => `คะแนน ${sc}`),
          ...(html.match(/\(−\d+(?:\.\d+)?\)/g) ?? []),
          ...(html.match(/คะแนน \d+\/100/g) ?? []),
          ...(html.match(/Data Confidence ปัจจุบัน: \d/g) ?? []),
          ...(html.includes('คะแนนสุดท้าย') ? ['คะแนนสุดท้าย'] : []),
        ];
        if (found.length) leaks.push(`${s.role} ${m.id} ${url}: ${[...new Set(found)].slice(0, 3).join(' | ')}`);
      }
    }
  }
  check(pages > 300 && leaks.length === 0, `Render ${pages} หน้า (ผู้บริโภค + ร้านค้าทุกร้าน) ไม่พบตัวเลขภายใน${leaks.length ? `\n      ${leaks.slice(0, 8).join('\n      ')}` : ''}`);
  // เจ้าหน้าที่ยังเห็นคะแนนที่หักในเหตุผลของ Confidence (หน้าพิจารณาผลประเมิน)
  const withDeduction = assessments.find((a) => a.result.confidence.reasons.some((x) => /\(−\d/.test(x)))!;
  check(!!withDeduction && /\(−\d/.test(view(`/o/assessments/${withDeduction.id}`, SESSION.officer)), 'เจ้าหน้าที่ยังเห็นคะแนนที่หักในเหตุผลของ Confidence');
  check(PV.withoutInternalPoints('ตัวอย่างคำสั่งซื้อน้อย (4) (−25)') === 'ตัวอย่างคำสั่งซื้อน้อย (4)', 'withoutInternalPoints ตัดเฉพาะคะแนนที่หัก (คงจำนวนข้อมูลของร้านเอง)');
  // ข้อร้องเรียน: ร้านค้าเห็นชื่อผู้ร้องแบบปิดบัง ไม่เห็นเบอร์โทร/อีเมล
  const consumers = (await import('@/mock/data')).consumers;
  const pii: string[] = [];
  for (const c of complaints) {
    const m = merchants.find((x) => x.id === c.merchantId);
    const who = consumers.find((x) => x.id === c.consumerId);
    if (!m || !who) continue;
    const html = view(`/m/complaints/${c.id}`, { role: 'merchant', operatorId: m.operatorId, activeMerchantId: m.id });
    if (html.includes(who.phone) || html.includes(who.email) || html.includes(who.name)) pii.push(c.id);
  }
  check(complaints.length > 0 && pii.length === 0, `ร้านค้าไม่เห็นชื่อเต็ม เบอร์โทร หรืออีเมลของผู้ร้อง (${complaints.length} เรื่อง)${pii.length ? ` — พบ: ${pii.join(', ')}` : ''}`);
}

describe('Public projection — ไม่มีคะแนนและรายละเอียดภายใน');
{
  const all = S.useAssessmentStore.getState().items;
  const keysOf = (o: unknown, acc: string[] = []): string[] => {
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) acc.push(k), keysOf(v, acc);
    return acc;
  };
  const leaks = all.flatMap((a) => keysOf(PV.publicAssessmentView(a.result)).filter((k) => (PV.PUBLIC_FORBIDDEN_KEYS as readonly string[]).includes(k)));
  check(all.length > 0 && leaks.length === 0, `publicAssessmentView ของผลประเมินทั้งหมด ${all.length} รายการไม่มีฟิลด์ต้องห้าม${leaks.length ? ` — พบ: ${[...new Set(leaks)].join(', ')}` : ''}`);
  const sample = PV.publicAssessmentView(all[0].result);
  check(['band', 'standing', 'publicSummary', 'coverage', 'confidence', 'dataSources'].every((k) => k in sample), 'Public projection มี Band, สถานะ, Coverage, ระดับ Confidence, สรุปสาธารณะ และแหล่งข้อมูล');
  check(src('features/trust-assessment/components/AssessmentParts.tsx').includes('publicAssessmentView(latest.result)'), 'PublicAssessmentCard ใช้ Public projection');
}

// ---------------------------------------------------------------------------
describe('หน้าแรก — เกณฑ์ Band A/B/C/D และข้อมูลขั้นต่ำ (ตัวเลขจาก Engine)');
{
  const M = (await import('@/features/trust-assessment/model')).MODEL_V2;
  const home = view('/').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  check(home.includes('เกณฑ์การจัดระดับความน่าเชื่อถือ') && home.includes('ประเมินจากข้อมูลร้านค้าและพฤติกรรมการดำเนินงาน โดยใช้คะแนน 0–100'), 'มีหัวข้อและคำอธิบาย');
  for (const [label, w] of [['ตัวตนและธุรกิจ', M.weights.C1], ['ผลการขายและการจัดส่ง', M.weights.C2], ['เสียงลูกค้า (รีวิว)', M.weights.C3], ['การแก้ไขปัญหาและข้อร้องเรียน', M.weights.C5], ['ความสมเหตุสมผลของราคา', M.weights.C4]] as const) {
    check(home.includes(label) && home.includes(`${w}%`), `ปัจจัย ${label} ${w}%`);
  }
  check(home.includes(`คะแนน ≥ ${M.bands.A}`) && home.includes(`Data Coverage ≥ ${M.bandA.minCoverage}%`) && home.includes('Data Confidence สูง') && home.includes('ไม่มี Risk Signal'), 'Band A: 4 เงื่อนไขครบ');
  check(home.includes('ได้สูงสุด Band B'), 'Band A: ระบุว่าเงื่อนไขอื่นไม่ผ่านได้สูงสุด Band B');
  check(home.includes(`${M.bands.B}–${M.bands.A - 1}`) && home.includes(`${M.bands.C}–${M.bands.B - 1}`) && home.includes(`< ${M.bands.C}`), 'ช่วงคะแนน B / C / D ตรงกับ Engine');
  check(home.includes('ไม่มี Badge แสดงต่อผู้บริโภค'), 'Band D: ไม่มี Badge');
  check(home.includes(`−${M.penalties.seriousOpenComplaint}`) && home.includes(`−${M.penalties.priceWatch}`), 'ตัวอย่าง Risk Signal พร้อมคะแนนที่หัก');
  check(home.includes('ข้อมูลยังไม่เพียงพอ') && home.includes('ไม่ได้หมายความว่าร้านค้ามีปัญหา'), 'ข้อมูลไม่ครบ → "ข้อมูลยังไม่เพียงพอ" พร้อมหมายเหตุ');
  check(home.includes(`${M.minimums.months} เดือน`), 'ข้อมูลขั้นต่ำ: คำสั่งซื้อ รีวิว และระยะเวลาการขาย');
  const minBlock = home.slice(home.indexOf('ข้อมูลขั้นต่ำก่อนจัดระดับ Band'), home.indexOf('ข้อมูลยังไม่ถึงขั้นต่ำ'));
  check(minBlock.length > 0 && !minBlock.includes('ยืนยันตัวตน'), 'การยืนยันตัวตนไม่อยู่ในรายการข้อมูลขั้นต่ำก่อนจัดระดับ Band');
  const AP = (await import('@/features/automation/policy')).ROUTING_POLICY;
  check(AP.requireIdentityVerified && home.includes('Verified Identity') && home.includes('เงื่อนไขก่อนแสดง Badge') && home.includes('ไม่ใช่เงื่อนไขในการคำนวณ Band'), 'ยืนยันตัวตน = เงื่อนไขก่อนแสดง Badge (ตาม Policy) ไม่ใช่เงื่อนไขคำนวณ Band');
  check(home.includes('เกณฑ์เริ่มต้นจากระบบต้นแบบ') && home.includes('ปรับร่วมกับหน่วยงานได้'), 'มี Tag ว่าเป็นเกณฑ์เริ่มต้นจากระบบต้นแบบ');
  check(home.includes('คะแนนตัวเลข 0–100 แสดงเฉพาะเจ้าหน้าที่'), 'ระบุว่าคะแนนตัวเลขแสดงเฉพาะเจ้าหน้าที่');
  check(!home.includes('คะแนนสุดท้าย'), 'หน้าแรกไม่มีคะแนนของร้านใด');
  const order = ['home-assessment', 'home-band-criteria', 'home-badge'].map((id) => src('features/onboarding/WelcomePage.tsx').indexOf(id === 'home-band-criteria' ? '<BandCriteriaSection />' : `id="${id}"`));
  check(order[0] < order[1] && order[1] < order[2], 'ลำดับ: Trust Assessment → เกณฑ์ Band → Assessment Badge');
}

finish();
