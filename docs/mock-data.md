# Mock Data

ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ชื่อบุคคล/ร้าน/ลิงก์ไม่อ้างอิงบุคคลหรือร้านค้าจริง ใช้ **Mock Identity ID** (`MID-xxxx-xx`) แทนเลขบัตรประชาชน และเลขนิติบุคคลรูปแบบ `DEMO-…` อีเมลใช้โดเมน `demo.local` และเว็บไซต์ใช้ `*.example`

## จำนวน (ตามข้อกำหนดขั้นต่ำ)

| ชุดข้อมูล | จำนวน | ไฟล์ |
|---|---|---|
| Merchants (ร้านค้า) | 12 | `src/mock/data/merchants.ts` |
| Operators (ผู้ประกอบการ) | 12 (OP-012 ยืนยันตัวตนแล้วแต่ยังไม่มีร้าน — ใช้ใน Scenario 2) | `people.ts` |
| Consumers | 8 | `people.ts` |
| Officers | 3 + Admin 1 | `people.ts` |
| Complaint Cases | 20 | `complaints.ts` (สร้าง Timeline/ข้อความ/ข้อเสนอจากสถานะ และคำนวณ Screening จริง) |
| Verification Applications | 10 | `applications.ts` |
| Certification Records | 10 | `applications.ts` |
| Warning / Corrective Records | 8 | `warnings.ts` |
| Risk Cases | 4 | `warnings.ts` |
| Training Courses | 6 (แต่ละหลักสูตร 2–3 บท + 4 ข้อสอบ) | `training.ts` |
| Training Enrollments | 15 | `training.ts` |
| Notifications | 20 | `notifications.ts` |
| Audit Log | 9 | `notifications.ts` |
| AI History | 4 (ตัวอย่าง) | `aiHistory.ts` |

## ร้านค้าและสถานะ

| ID | ร้าน | Operator | ลงทะเบียน | ใบรับรอง | ความเสี่ยง |
|---|---|---|---|---|---|
| M-001 | บ้านผ้าคราม สกลนคร | OP-001 | approved | SMT-2569-000101 L3 active | none |
| M-002 | ครัวแม่มาลี | OP-002 | pending_review | — | none |
| M-003 | สวยใสคอสเมติก (นิติบุคคล) | OP-003 | approved | SMT-2569-000102 L2 active | warning |
| M-004 | ไอทีแกดเจ็ตช็อป | OP-004 | approved | SMT-2569-000103 L2 suspended | suspended |
| M-005 | ร้านกาแฟดอยสูง | OP-005 | approved | SMT-2569-000104 L3 active | none |
| M-006 | ผลไม้สดจันทบุรี | OP-006 | approved | SMT-2569-000105 L2 active | none |
| M-007 | ของเล่นไม้ลูกรัก | OP-007 | approved | SMT-2568-000044 L2 expired | none |
| M-008 | เฮลท์ตี้ซัพพลีเมนต์ | OP-008 | approved | SMT-2569-000106 L3 revoked | revoked |
| M-009 | ผ้าไหมบุรีรัมย์ (นิติบุคคล) | OP-009 | approved | SMT-2569-000107 L2 active | under_investigation |
| M-010 | สมุนไพรบ้านนา | OP-010 | need_info | — | none |
| M-011 | เครื่องหนังภูเก็ต | OP-011 (ยังไม่ e-KYC) | draft | — | none |
| M-012 | เฮลท์พลัสช็อป | OP-008 (ร้านใหม่) | submitted | — | allegation + identityFlag |

ใบรับรองที่ถูกแทนที่: SMT-2569-000098 (M-001 L2), SMT-2569-000099 (M-005 L2)

## ความเชื่อมโยงผ่าน ID

```
Operator (OP-xxx) 1──n Merchant (M-xxx)
Operator 1──n Enrollment (ENR-xxx) n──1 Course (CRS-xx)
Merchant 1──n VerificationApplication (APP-2569-xxxx)
Merchant 1──n Certification (SMT-…)        ← ใบปัจจุบัน = issuedAt ล่าสุด
Merchant 1──n Complaint (CMP-2569-xxxx) n──1 Consumer (CS-xxx)
Merchant 1──n WarningRecord (WRN-2569-xxxx) ──> courseIds, relatedComplaintIds
Merchant 1──n RiskCase (RSK-2569-xxxx) ──> relatedComplaintIds
Notification ──> recipientRole + recipientId (OP / CS / ว่าง = ทุกคนในบทบาท)
```

`tests/workflows.test.mts` ตรวจ Foreign key ระหว่างชุดข้อมูลเหล่านี้

## เลขที่เอกสารใหม่

สร้างต่อเนื่องจากเลขสูงสุดเดิมด้วย `nextRef()` (`utils/id.ts`) ปีเป็น พ.ศ. เช่น เรื่องร้องเรียนใหม่เรื่องแรกคือ `CMP-2569-0021` (เมื่อรันในปี 2026)

## วันที่

ข้อมูลตั้งต้นอยู่ช่วง ก.ย. 2568 – ต.ค. 2569 (ค.ศ. 2025–2026) ส่วนรายการใหม่ใช้เวลาปัจจุบันของเครื่อง หากเปิดสาธิตห่างจากช่วงนี้มาก กราฟแนวโน้ม 7 เดือนล่าสุดอาจแสดงข้อมูลตั้งต้นน้อยลง (ข้อมูลยังถูกต้อง เพียงอยู่นอกช่วงเวลา)

## จุดเริ่มต้นของ Demo Scenario

เมื่อกด Start Demo (แบบเดี่ยว) ระบบ Reset แล้วเรียก `prepare()` ของเรื่อง ซึ่งใช้ Fixture ใน `src/mock/scenarios/fixtures.ts` (คืนเฉพาะรายการที่เกี่ยวข้องจาก Seed แล้วปรับ — ผลเหมือนเดิมทุกครั้ง ทดสอบใน `tests/scenarios.test.mts`):

| Scenario | ข้อมูลที่ใช้ | Fixture |
|---|---|---|
| 1 | สร้างผู้ประกอบการใหม่ระหว่างสาธิต | — |
| 2 | ผู้ประกอบการจาก S1 (Journey) หรือ OP-012 (เดี่ยว) | — |
| 3–4 | ร้านจาก S2 (Journey) หรือ M-001 (เดี่ยว) · ผู้บริโภค CS-001 / CS-003 | — |
| 5 | กรณีศึกษา M-003 / OP-003 | `fixtureWarningCaseStudy` — `WRN-2569-0001` เป็นประวัติที่ปิดแล้ว, การอบรม ENR-005 คืนตาม Seed, ร้านไม่มีคำเตือนค้าง → เจ้าหน้าที่ออกคำเตือนใหม่ในการสาธิต |
| 6 | กรณีศึกษา M-004 / OP-004 / `RSK-2569-0001` | `fixtureBeforeSuspension` — เรื่องอยู่ระหว่างตรวจสอบ ใบรับรองยัง Active และลบการแจ้งเตือน/Audit ของการระงับเดิม |
| 7 | บัญชีจาก S1 (Journey) หรือ OP-001 | `fixtureAdChecker` — หน้าตรวจโฆษณาว่าง |
| 8 | `CMP-2569-0005` ของ OP-003 · ผู้บริโภค CS-007 | `fixtureComplaintCase` — เคสกลับเป็นรอร้านค้าตอบ และล้างร่างคำตอบเดิม |

ประวัติ AI ตัวอย่าง 4 รายการอยู่ใน `src/mock/data/aiHistory.ts` · ตัวอย่างข้อความโฆษณา/ข้อร้องเรียนอยู่ใน `src/features/ai-assistant/data/aiExamples.ts` (ข้อมูลสมมติทั้งหมด)
