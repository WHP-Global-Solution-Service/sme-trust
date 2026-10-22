import { applications, certifications } from './applications';
import { buildComplaints } from './complaints';
import { merchants } from './merchants';
import { auditLog, notifications } from './notifications';
import { consumers, officers, operators } from './people';
import { courses, enrollments } from './training';
import { riskCases, warnings } from './warnings';
import { aiHistory } from './aiHistory';

export { DEMO_PIN } from './people';
export { consumers, officers, courses };

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** ชุดข้อมูลเริ่มต้นใหม่ทุกครั้งที่เรียก (ใช้สำหรับ Reset Demo Data) */
export const seed = {
  operators: () => clone(operators),
  merchants: () => clone(merchants),
  applications: () => clone(applications),
  certifications: () => clone(certifications),
  complaints: () => buildComplaints(),
  warnings: () => clone(warnings),
  riskCases: () => clone(riskCases),
  enrollments: () => clone(enrollments),
  notifications: () => clone(notifications),
  audit: () => clone(auditLog),
  aiHistory: () => clone(aiHistory),
};
