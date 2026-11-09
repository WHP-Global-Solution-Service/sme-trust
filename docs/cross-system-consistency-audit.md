# Cross-System Consistency Audit

ตรวจเมื่อ 9 พ.ย. 2569 บน Branch `sme-trustv.2` หลังเพิ่ม Unified Onboarding · ตรวจด้วยการอ่านโค้ด ค้นข้อความทั้งระบบ Render ทุกเส้นทาง (SSR) และ E2E

## 1. หน้าที่ตรวจสอบ

| กลุ่ม | หน้า |
|---|---|
| Public / Consumer | หน้าแรก (`/`) · ค้นหา/ทำเนียบร้าน (`/check`, `/directory`) · หน้าร้าน (`/shop/:id`) · ตรวจใบรับรอง/QR (`/verify`, `/verify/:id`) · แจ้งปัญหา (`/report`) · เรื่องของฉัน |
| Merchant | หน้าหลัก (`/m`) · ลงทะเบียนร้าน (`/m/register-shop`) · สมัครด้วย Marketplace (`/m/register-shop/marketplace`) · ข้อมูลร้าน (`/m/shop`) · เชื่อมต่อ Marketplace (`/m/marketplace`, `/data/:id`, `/analysis`, `/profile/:id`) · Marketplace App (`/m/marketplace-app`) · ยืนยันตัวตน (`/m/kyc`) · ผลประเมิน (`/m/trust`) · ใบรับรอง · การแจ้งเตือน · คำขอเปลี่ยนข้อมูลร้าน · ข้อร้องเรียน · คำเตือน · AI |
| Officer | Dashboard (`/o`) · Exception Queue (`/o/exceptions`, `/:id`) · คำขอ (`/o/applications/:id`) · ช่องทางขาย · ใบรับรอง · ข้อร้องเรียน · คำเตือน/Corrective · ผลประเมิน (`/o/assessments/:id`) · คำขอเปลี่ยนข้อมูลร้าน · ความเสี่ยง · กฎอัตโนมัติ (`/o/automation`) |
| Admin | Dashboard · โมเดลการประเมิน · บัญชี · Audit Log · ข้อมูลสาธิต (Export/Reset) |
| Demo | Demo Center (`/demo`) · Demo Controller · หน้าจบ Scenario · Executive Summary (`/demo/v2/summary`) · Scenario 1–15, 9A, 9B · Full Journey ทั้งสองชุด |

## 2. ประเด็นที่พบและสิ่งที่แก้ไข

| # | ประเด็น | ระดับ | การแก้ไข | ระบบที่ได้รับผล |
|---|---|---|---|---|
| A1 | ข้อความ "v1/v2" ในหน้าที่ผู้ใช้เห็น: Executive Summary ("v2 เพิ่มอะไรจาก v1", ตาราง v1/v2, "เส้นทางการสาธิต v2", "Workflow v1 เดิม"), หน้าผลประเมินเจ้าหน้าที่ ("เกณฑ์ v1 ของ Level"), หน้าผลประเมินร้าน ("Workflow v1"), เหตุผลข้อเสนอของ Engine, คำแนะนำขั้นตอน Scenario 9–13 (10 จุด), หัว Demo Center | P2 | เปลี่ยนเป็น "เกณฑ์การรับรอง" / "กระบวนการรับรอง" / "Consumer Protection (เดิม)" / "Marketplace & Trust Assessment" — รหัสภายในไม่เปลี่ยน | Demo, Officer, Merchant, Engine (ข้อความเท่านั้น) |
| A2 | เอกสารประกอบเป็นรายการคงที่ ไม่ขึ้นกับประเภทผู้ประกอบการ ผู้มีอำนาจ หรือหมวดสินค้า | P2 | Dynamic Document Requirements + Checklist ในขั้นเอกสาร | Registration |
| A3 | ไม่มีการกัน Shop ID เดียวกันถูกเชื่อมกับหลายร้าน | P1 | กันซ้ำในบัญชีเดียวกัน · ร้านอื่นอ้าง → MANUAL_REVIEW | Marketplace, Automation, Officer |
| A4 | ร้านที่สมัครเองไม่ถูกประมวลผลจนกว่าจะมีเหตุการณ์อื่น (ไม่มี Badge/คำแนะนำ) | P2 | ประมวลผลทันทีหลังส่งคำขอ (Insufficient Data + คำแนะนำ ไม่ใช่ผลลบ) · เส้นทาง Marketplace ประมวลผลหลังเชื่อมต่อเท่านั้น (กันแจ้งเตือนชั่วคราว) | Registration, Automation, Notifications |
| A5 | Badge ไม่มีชื่อร้าน ลิงก์ตรวจสอบ หรือ QR | P2 | เพิ่มชื่อร้าน Coverage Confidence วันที่ แหล่งข้อมูล ลิงก์ และ Mock QR | Merchant, Consumer |
| A6 | ไม่มีสรุปการตรวจสอบตัวตน/ธุรกิจในมุมร้านค้าและเจ้าหน้าที่ | P2 | Verification Summary ใน `/m/shop`, `/o/applications/:id`, ขั้นตรวจสอบก่อนส่ง | Merchant, Officer |
| A7 | หน้าการเชื่อมต่อไม่แสดงที่มาของข้อมูลและความเป็นเจ้าของร้าน | P3 | เพิ่มที่มาของข้อมูลและสถานะความเป็นเจ้าของในการ์ดแต่ละแพลตฟอร์ม · ขั้นยินยอมระบุว่าเชื่อมกับร้านเดิม | Marketplace |
| A8 | หน้าแรกเป็น Concept เดิม (ข้อความยาว ไม่เป็นขั้นตอน) | P2 | Executive Redesign 8 Section ตามข้อกำหนด | Public |
| A9 | Demo Center เลือกตามชุด v1/v2 เท่านั้น ไม่มีมุม User Journey · คำอธิบายชุดยังเป็น "Scenario 9–13" ทั้งที่มี 14/15 | P3 | เพิ่ม "เลือกตาม User Journey" + Demo แนะนำ · แก้คำอธิบายเป็น 9–15 · ประโยชน์ทางธุรกิจในตัวควบคุมการสาธิต | Demo |
| A10 | ปุ่ม "เข้าสู่ระบบ" อยู่ใน Hero (เกิน 4 CTA ตามข้อกำหนด) | P3 | ย้ายไปที่ Header (ยังใช้งานได้) | Public |

ไม่พบ P0 · P1 ที่พบ (A3) แก้แล้วพร้อม Regression Test

## 3. ตรวจซ้ำหลังแก้ (สิ่งที่ยังคงเดิมโดยตั้งใจ)

- รหัสภายใน (`track: 'v1' | 'v2'`, `/demo/v2/summary`, `smetrust:v2:*`, ชื่อไฟล์ `workflowsV2.ts`) ไม่เปลี่ยน — ไม่ใช่ข้อความที่ผู้ใช้เห็น และเปลี่ยนแล้วกระทบ URL/ข้อมูลที่บันทึกไว้
- ข้อความ "Trust Badge" ในหน้าเครื่องมือส่งเสริมร้านค้าหมายถึงตราใบรับรอง (Certification) ตามกระบวนการเดิม — แยกจาก Assessment Badge แล้วในหน้าที่เกี่ยวข้อง
- Admin/Officer ไม่ได้ Redesign ทั้งหมด — ปรับเฉพาะข้อมูลและหน้าจอให้ตรง Workflow ปัจจุบัน

## 4. Regression Tests

| ชุด | ครอบคลุม |
|---|---|
| `tests/v2/onboarding.test.mts` (ใหม่) | KYC/DBD จำลอง · Dynamic Documents · Verification Summary · Self-Registration ประเมินอัตโนมัติ ไม่ถูกหักคะแนน ไม่ซ้ำ · เพิ่ม Marketplace ภายหลัง (ร้านเดิม) · หลายแพลตฟอร์ม · Shop ID ซ้ำ/อ้างความเป็นเจ้าของ · Raw Data · Engine ไม่เปลี่ยน · KYC → Assessment → Badge · Badge ทุกมุมมอง |
| `tests/e2e/onboarding.spec.ts` (ใหม่) | นิติบุคคล + Mock DBD + หนังสือมอบอำนาจ + Officer เห็นสรุปเดียวกัน · สมัครเองแล้วเพิ่ม Shopee (ร้านเดิม, Badge อัปเดต, QR/ลิงก์) · เลือกร้านใน Marketplace ที่เชื่อมแล้วซ้ำไม่ได้ |
| `tests/e2e/home.spec.ts` + `tests/v2/profile-change.test.mts` (หน้าแรก) | ข้อความตามข้อกำหนด · 4 CTA ไปที่จริง · 5 ขั้นตอน · 2 ช่องทาง · Demo ตาม Journey · ไม่มี v1/v2 · ไม่อ้างตัวเลขลดภาระงาน · 375/768/1440px |
| ชุดเดิมทั้งหมด | Scenario 1–15, 9A, 9B, Full Journey, Automation, Release Verification, Render ทุกเส้นทาง |

## 5. Known Limitations

ดู `docs/known-issues.md` — KI-V2-28 ถึง KI-V2-30 (KI-V2-31, KI-V2-32 แก้แล้วในรอบ Final Release Validation)

## 6. Final Release Validation (9 พ.ย. 2569 · ฐาน `0123a25`)

ตรวจซ้ำทั้งระบบเพื่อเตรียม Release Candidate — ไม่เพิ่ม Feature ใหม่

| # | ประเด็น | ระดับ | ผล / การแก้ไข |
|---|---|---|---|
| F1 | **KI-V2-32** E2E Restart/Back-Next ไม่ผ่านครั้งคราว | P2 (Bug ของแอป) | ตรวจ Race condition, Navigation แบบ Async, State ใน localStorage, Fixture, การแยก Test, Worker พร้อมกัน, Missing await · **Root cause:** Router เปิด `v7_startTransition` — ตัวควบคุมการสาธิตเทียบเป้าหมายกับ location ของ React ที่ยังไม่อัปเดต จึงข้ามการเปลี่ยนหน้า (ขั้นเปลี่ยน หน้าจอไม่เปลี่ยน) · แก้ที่ `enterStep` ให้เทียบกับเส้นทางจริงของเบราว์เซอร์ · Regression Unit + E2E ตรวจ URL · Chromium ครบทุกชุด 2 รอบ 80/80 และซ้ำ 10 รอบ 110/110 |
| F2 | **KI-V2-31** ไม่มีปุ่มเข้าสู่ระบบบนจอ < 640px | P2 | ปุ่มเข้าสู่ระบบใน Header ทุกขนาด · Demo Mode เป็นไอคอนบนจอเล็ก · ตรวจ 320/375/390/768/1440px · เข้าสู่ระบบแล้วกลับไปขั้นตอนลงทะเบียนที่ตั้งใจไว้ |
| F3 | Unified Registration | — | Marketplace Auto-Fill · สมัครเอง · บุคคลธรรมดา · นิติบุคคล (Mock DBD + หนังสือมอบอำนาจ) · Dynamic Documents · Save Draft / Refresh-Resume · เพิ่ม Marketplace ภายหลัง · หลายแพลตฟอร์ม · กันร้านซ้ำ · Ownership conflict · Mock KYC · Verification status — ผ่าน · **ID ไม่ซ้ำ** ใน Merchant / Application / Connection / Assessment / Officer Task หลังทุก Flow (Unit ใหม่) |
| F4 | Assessment & Badge | — | AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW · Band/Coverage/Confidence · Badge ตรงกันมุมร้านค้า ผู้บริโภค เจ้าหน้าที่ · ระงับ/เพิกถอน/คำขอไม่ผ่าน → ไม่แสดง Badge ที่มีผล · Level 2–4 ไม่อนุมัติอัตโนมัติ — ผ่าน |
| F5 | หน้าแรก & Demo | — | 8 Section ครบ · ไม่มีชื่อ v1/v2 ในเมนู/ข้อความที่ผู้ใช้เห็น (เหลือเฉพาะรหัสภายในและ URL `/demo/v2/summary`) · Scenario 1–15, 9A, 9B และ Full Journey ทั้งสองชุดผ่าน |
| F6 | Production / ความปลอดภัย | — | Build `/sme-trust/` ผ่าน · `404.html` Fallback · ไม่พบ Secret · ไม่มี `fetch`/XHR ในโค้ด · URL ใน Bundle มีเฉพาะ Namespace ของ SVG และลิงก์คำเตือนของ Library (ไม่ถูกเรียก — Pages จำลองยืนยันไม่มี Request ไปโดเมนอื่น) |

ไม่พบ P0/P1 · ผล Test ทั้งหมดดู `docs/test-checklist.md`
