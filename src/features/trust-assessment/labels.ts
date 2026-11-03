import type { Tone } from '@/constants/labels';
import type { AssessmentStatus, BandOrInsufficient, ConfidenceLevel, OfficerDecisionKind, Recommendation, Standing } from './types';

export const BAND_LABEL: Record<BandOrInsufficient, { label: string; desc: string; tone: Tone }> = {
  A: { label: 'Band A — น่าเชื่อถือสูง', desc: 'ข้อมูลหลายด้านสอดคล้องกันในเกณฑ์ดี', tone: 'success' },
  B: { label: 'Band B — น่าเชื่อถือ', desc: 'ข้อมูลส่วนใหญ่อยู่ในเกณฑ์ดี', tone: 'success' },
  C: { label: 'Band C — ควรติดตาม', desc: 'มีบางด้านที่ควรปรับปรุงหรือตรวจสอบเพิ่มเติม', tone: 'warning' },
  D: { label: 'Band D — มีความเสี่ยงสูง', desc: 'หลายด้านต่ำกว่าเกณฑ์ ควรตรวจสอบก่อนตัดสินใจซื้อ', tone: 'error' },
  insufficient: { label: 'Insufficient Data — ข้อมูลยังไม่เพียงพอ', desc: 'ข้อมูลยังน้อยเกินกว่าจะประเมิน ไม่ได้หมายความว่าร้านมีปัญหา', tone: 'neutral' },
};

export const STANDING_LABEL: Record<Standing, { label: string; tone: Tone }> = {
  normal: { label: 'สถานะการรับรองปกติ', tone: 'success' },
  under_review: { label: 'อยู่ระหว่างพิจารณาความเสี่ยง', tone: 'warning' },
  suspended: { label: 'Suspended — ระงับการรับรอง', tone: 'error' },
  revoked: { label: 'Revoked — เพิกถอนการรับรอง', tone: 'error' },
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, { label: string; tone: Tone }> = {
  high: { label: 'ความเชื่อมั่นของข้อมูลสูง', tone: 'success' },
  medium: { label: 'ความเชื่อมั่นของข้อมูลปานกลาง', tone: 'warning' },
  low: { label: 'ความเชื่อมั่นของข้อมูลต่ำ', tone: 'neutral' },
};

export const RECOMMENDATION_LABEL: Record<Recommendation['kind'], { label: string; tone: Tone }> = {
  blocked: { label: 'ไม่สามารถพิจารณา Badge (สถานะการรับรองไม่ปกติ)', tone: 'error' },
  refer_risk: { label: 'ควรส่งพิจารณาความเสี่ยง', tone: 'error' },
  need_more_data: { label: 'ควรขอข้อมูลเพิ่ม', tone: 'neutral' },
  consider_l3: { label: 'ประกอบการพิจารณา Level 3 (Trusted SME)', tone: 'success' },
  consider_l4: { label: 'ประกอบการพิจารณา Level 4', tone: 'success' },
  not_yet: { label: 'ยังไม่ถึงเกณฑ์ประกอบการยกระดับ', tone: 'warning' },
};

export const ASSESSMENT_STATUS: Record<AssessmentStatus, { label: string; tone: Tone }> = {
  draft: { label: 'ร่าง (ยังไม่ส่งพิจารณา)', tone: 'neutral' },
  pending_review: { label: 'รอเจ้าหน้าที่พิจารณา', tone: 'warning' },
  decided: { label: 'พิจารณาแล้ว', tone: 'info' },
};

export const DECISION_LABEL: Record<OfficerDecisionKind, { label: string; tone: Tone }> = {
  approved: { label: 'อนุมัติยกระดับ', tone: 'success' },
  need_info: { label: 'ขอข้อมูลเพิ่มเติม', tone: 'warning' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'error' },
  escalated: { label: 'ส่งพิจารณาความเสี่ยง', tone: 'error' },
};

export const ASSESSMENT_DISCLAIMER =
  'ผลประเมินเป็นการจำลองด้วยกฎจากข้อมูลสมมติ ไม่ใช่คะแนนเครดิต ไม่ใช่การรับรองทางกฎหมาย และไม่ใช่บัญชีดำ — การให้หรือยกระดับ Badge ต้องผ่านการพิจารณาของเจ้าหน้าที่เสมอ';
