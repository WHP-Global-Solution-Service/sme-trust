# Requirements — ขอบเขตและการแมปข้อกำหนด

## วัตถุประสงค์

| ด้าน | วิธีที่ Prototype ตอบโจทย์ |
|---|---|
| Prevention First | ตรวจสอบร้านค้าก่อนซื้อ (ค้นหา/QR), ระดับการรับรองพร้อมคำอธิบายความหมาย, คำแนะนำด้านการคุ้มครองผู้บริโภคในหน้า Merchant Home, ศูนย์อบรม |
| Trusted SME | Trust Level 1–4, ใบรับรองพร้อม QR, SME Trust Passport, Marketing Toolkit นำ Badge/ลิงก์ไปใช้บนช่องทางขายเดิม, Merchant Directory |
| Consumer Protection | แจ้งปัญหา 7 ขั้นตอน, ติดตามสถานะ, ตอบข้อเสนอ, ขอส่งต่อเจ้าหน้าที่ได้ทุกเมื่อ, ส่งต่อทันทีสำหรับกรณีเสี่ยงร้ายแรง |
| Reduce OCPB Workload | Merchant First Resolution, Complaint Screening Assistant (Rule-based), Work Queue เรียงตามความสำคัญ, KPI "ร้านค้าแก้ไขสำเร็จ" vs "ส่งต่อ" |

## การแมปโมดูล → หน้าจอ

| Module | หน้าจอ / ไฟล์หลัก |
|---|---|
| A Onboarding & Auth | `/` Welcome, `/register` (6 ขั้น), `/login` (PIN, ลืม PIN, Biometric), `/m/kyc` — `features/onboarding`, `features/auth` |
| B Merchant Home | `/m` — `features/merchants/MerchantHome.tsx` |
| C SME Registration | `/m/register-shop` (7 ขั้น, Draft/Resume), `/m/shop` (สถานะ, ส่งข้อมูลเพิ่ม/ยื่นใหม่, ช่องทางขาย) |
| D Merchant Verification | `/o/applications`, `/o/applications/:id` (Checklist, ขอเอกสาร, อนุมัติ, ไม่อนุมัติ, Timeline, Audit) |
| E Trust Certification | `/m/certification`, `/verify/:certId`, `/o/certification` |
| F SME Trust Passport | `/m/passport` |
| G Consumer Verification | `/check`, `/directory`, `/shop/:id`, `/verify`, `/verify/:certId` |
| H Complaint Center | `/report` (7 ขั้น), `/consumer/cases`, `/consumer/cases/:id` |
| I Merchant First Resolution | `/m/complaints`, `/m/complaints/:id` |
| J Screening Assistant | `utils/screening.ts`, `features/complaints/ScreeningPanel.tsx`, Override ใน `/o/complaints/:id` |
| K Warning & Corrective | `/m/warnings*`, `/o/warnings*`, `/o/warnings/new`, `/o/corrective` |
| L Training Center | `/m/training`, `/m/training/:courseId`, `/o/training` |
| M Risk / Suspension / Appeal | `/m/review`, `/o/risk`, `/o/risk/:id` |
| N Directory & Promotion | `/directory`, `/m/toolkit` |
| O Officer Portal | `/o/*` |
| P Admin Dashboard | `/admin`, `/admin/accounts`, `/admin/audit`, `/admin/data` |
| AI-01 Advertising Compliance Checker | `/m/ai/ad-checker` — `features/ai-assistant` (ดู `ai-simulation.md`) |
| AI-02 Complaint Resolution Assistant | `/m/ai/complaint`, ปุ่มในหน้า `/m/complaints/:id` |
| AI History | `/m/ai`, `/m/ai/history` |
| Demo Presentation Mode | `/demo`, `/demo/complete/:id`, `/demo/overview`, Demo Controller (ดู `demo-scenario-architecture.md`) |

## สมมติฐานที่ตัดสินใจเอง (ข้อกำหนดไม่ระบุชัด)

1. **ผู้ประกอบการ (Operator) แยกจากร้านค้า (Merchant)** — คนหนึ่งมีได้หลายร้าน; e-KYC ผูกกับบุคคล, การรับรองผูกกับร้าน, Passport รวมทุกร้านของบุคคล
2. **Trust Level** คำนวณจาก: L0 ยังไม่ยืนยันตัวตน → L1 ผ่าน e-KYC → L2 ใบรับรองระดับ Business Verified (ออกอัตโนมัติเมื่ออนุมัติคำขอลงทะเบียน) → L3/L4 ต้องยื่นขอและผ่านเกณฑ์ (`utils/criteria.ts`) ระดับที่ใช้งานได้คือระดับของใบรับรองที่ Active เท่านั้น
3. **สถานะสาธารณะ (Verdict)** ใช้สถานะใบรับรองเป็นหลัก: เพิกถอน > ระงับ > หมดอายุ > รับรอง/ผ่านเกณฑ์ธุรกิจ > อยู่ระหว่างยื่นคำขอ > ยืนยันตัวตน > ยังไม่ยืนยันตัวตน หน้าสาธารณะ **ไม่แสดง** ข้อกล่าวหาหรือการตรวจสอบที่ยังไม่มีข้อสรุป
4. **ร้านฉบับร่าง (Draft) ไม่แสดงต่อสาธารณะ**
5. **ช่องทางขายตรวจแยกรายช่องทาง** ที่ `/o/verification` ไม่ผูกกับการอนุมัติร้าน
6. **Merchant Applications** รวมทั้งคำขอลงทะเบียนและคำขอรับรอง/ต่ออายุ ส่วนเมนู **Verification** ใช้ตรวจช่องทางขาย
7. **Corrective Actions** คือมุมมองกรองของ Warnings เฉพาะสถานะที่เกี่ยวกับการแก้ไข
8. **คำแนะนำ (Advisory)** ไม่เปลี่ยนสถานะความเสี่ยงของร้าน; **คำเตือน (Warning)** ทำให้ร้านมีสถานะ "มีคำเตือน" จนกว่าจะเสร็จสิ้น; **การระงับ/เพิกถอน** ทำผ่าน Risk Review เท่านั้น (หรือหน้าจัดการใบรับรองโดยตรงพร้อมเหตุผล)
9. **ห้ามระงับจากขั้น "ข้อกล่าวหา" โดยตรง** — ต้องเปิดการตรวจสอบ (Under Investigation) ก่อน ปุ่มระงับจึงจะปรากฏ
10. **ผู้ประกอบการที่ถูกระงับ/เพิกถอนเปิดร้านใหม่** — ระบบติดธง (Identity Flag) + สร้างเรื่องพิจารณาสถานะ "ข้อกล่าวหา" อัตโนมัติ แต่ **ไม่ปฏิเสธคำขออัตโนมัติ**
11. **การยุติเรื่อง (Dismiss) หลังระงับ** จะคืนสถานะใบรับรอง; การรับอุทธรณ์ (Overturned) คืนสถานะใบรับรองที่ถูกระงับหรือเพิกถอน
12. **การผ่านการอบรม** ที่ตรงกับหลักสูตรที่แนบในคำเตือน จะติ๊กรายการแก้ไขที่เกี่ยวกับ "อบรม" ให้อัตโนมัติ
13. **ช่วงเวลา (Period filter)** ใน Admin Dashboard มีผลกับข้อร้องเรียนและคำเตือน ส่วนตัวกรองจังหวัดมีผลกับทุกตัวชี้วัด
14. **Role Gate** — แต่ละเส้นทางกำหนดบทบาทที่เข้าได้ ถ้าไม่ตรงจะแสดง Permission Denied พร้อมปุ่มสลับบทบาท (ระดับ UI เท่านั้น)
15. **เส้นทางสาธารณะ** (`/check`, `/directory`, `/shop/:id`, `/verify*`) เข้าได้ทุกบทบาทโดยไม่ต้องเข้าสู่ระบบ
16. **AI Simulation อยู่ในบทบาทผู้ประกอบการเท่านั้น** — เป็นเครื่องมือช่วยร้านค้าก่อนเผยแพร่โฆษณาและก่อนตอบลูกค้า ไม่ใช่เครื่องมือตัดสินของเจ้าหน้าที่
17. **ร่างคำตอบจาก AI** ใส่ในช่องตอบกลับเท่านั้น ร้านค้าต้องเลือกรูปแบบการตอบกลับและกดส่งเองผ่าน `merchantRespond()` เดิม
18. **ประวัติ AI** เก็บเฉพาะชื่อตัวอย่าง/เลขเคสและผลสรุป ไม่เก็บข้อความที่ผู้ใช้พิมพ์เอง
19. **Full Journey** ใช้บัญชีเดียวกันใน Scenario 1–4 และ 7; Scenario 5, 6, 8 ใช้กรณีศึกษาแยกที่เตรียมไว้ เพราะต้องมีประวัติ (คำเตือน, ข้อร้องเรียนหลายเรื่อง) ที่ร้านใหม่ยังไม่มี

## Automation First, Human by Exception (Branch `sme-trustv.2` — ยังไม่เผยแพร่)

รายละเอียดเต็มใน [automation-first-workflow.md](automation-first-workflow.md)

| ข้อกำหนด | การแมป |
|---|---|
| Automatic Merchant Processing | ร้านลงทะเบียน แก้ไข เชื่อม Marketplace นำเข้า/Auto-Fill และส่งข้อมูลเพิ่มเองได้ · ระบบประเมินและจัดเส้นทางเองเมื่อข้อมูลเปลี่ยน (`stores/automation.ts`) |
| Automatic Assessment Badge | `useAssessmentBadgeStore` (หนึ่ง Badge ต่อร้าน) · แสดงที่ `/m/trust` และ `/shop/:id` ตามสิทธิ์ · ประวัติ + Model Version · Insufficient Data พร้อมคำแนะนำ |
| Decision Router | `features/automation/router.ts` — AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW · แยกการคัดกรองจากการตัดสินว่าทุจริต |
| Minimize Officer Workload | `/o` (Exception Queue + KPI), `/o/exceptions`, `/o/exceptions/:id`, `/o/automation` · หนึ่งงานต่อประเด็น ไม่มีงานซ้ำ |
| Profile Change Automation | `source_verified` — ชื่อร้าน/หมวดที่ตรงกับต้นฉบับ Marketplace บันทึกเอง · ค่าอื่นใช้ Workflow อนุมัติเดิม (Exception) · Raw Source อ่านอย่างเดียว |
| Certification Governance | `CERTIFICATION_POLICY` — Level 1 อัตโนมัติ (กฎเดิม) · Level 2–4 เจ้าหน้าที่อนุมัติ · ระบบอัตโนมัติไม่เปลี่ยนใบรับรอง |
| Automatic Monitoring | Event-based ขณะเปิดระบบ (ซิงก์ นำเข้า อายุข้อมูล มาตรการ ยืนยันตัวตน) + Run Simulation — ไม่ใช่ Real-time |
| Unified Demo | Scenario 14 (เส้นทางปกติ ไม่มีเจ้าหน้าที่) · Scenario 15 (กรณียกเว้น) · ชื่อใน UI ไม่แยก v1/v2 |

สมมติฐานที่ตัดสินใจเอง:

20. **Assessment Badge ต้องยืนยันตัวตน (Level 1) ก่อน** แต่ไม่ต้องรอใบรับรอง Level 2 — Badge เป็นผลประเมิน ไม่ใช่การรับรอง
21. **สัญญาณทั่วไปข้อเดียวไม่ส่งเจ้าหน้าที่** (Engine จำกัด Band สูงสุด B อยู่แล้ว) · ตั้งแต่ 2 ข้อหรือสัญญาณร่วม/ข้อร้องเรียนเร่งด่วน → MANUAL_REVIEW
22. **คำขอที่ต้องใช้อำนาจอนุมัติ** (ใบรับรอง Level 2–4, ชื่อร้านที่ตรวจไม่ได้) เป็นงานของเจ้าหน้าที่เสมอตามนโยบาย แต่ไม่ระงับ Assessment Badge — แสดงในหมวด Certification Requests ของ Exception Queue โดยลิงก์ไปที่เรื่องเดิม
23. **เจ้าหน้าที่ไม่อนุมัติกรณีสัญญาณ/หลักฐานขัดแย้ง** → เปิดเรื่องพิจารณาความเสี่ยงตามกระบวนการเดิม (ร้านชี้แจง/อุทธรณ์ได้) ไม่ระงับใบรับรองอัตโนมัติ
24. **ไม่อนุมัติกรณีข้อมูลตัวตนไม่ตรง** → ไม่ใช้ข้อมูลจากการเชื่อมต่อนั้นประเมิน (ไม่เปิดเรื่องความเสี่ยง และใบรับรองไม่เปลี่ยน)
25. **ระหว่าง MANUAL_REVIEW จาก Decision Router ผู้บริโภคไม่เห็น Band** เพราะข้อมูลอาจไม่ใช่ของร้าน · กรณีมีเรื่องพิจารณาความเสี่ยงเดิมยังแสดง Band + Standing ตามแนวทางเดิม (D8)

## Unified Platform Enhancement — Onboarding, KYC, Multi-Platform, Homepage (Branch `sme-trustv.2` — ยังไม่เผยแพร่)

รายละเอียด: [unified-merchant-onboarding.md](unified-merchant-onboarding.md) · [cross-system-consistency-audit.md](cross-system-consistency-audit.md) · [executive-demo-guide.md](executive-demo-guide.md)

| ข้อกำหนด | การแมป |
|---|---|
| Unified Registration (Path A / B) | `/m/register-shop/marketplace` → `/m/register-shop?from=import` · `/m/register-shop` — Merchant/Application/Assessment/Badge กลาง · Draft/Resume/ไม่ส่งซ้ำ |
| Merchant KYC & Business Verification | `features/onboarding/verification.ts` — ประเภทเอกสารยืนยันตัวตน · Mock Reference แบบปิดบัง · Mock DBD (ตรวจรูปแบบเท่านั้น) · ผู้แทน/หนังสือมอบอำนาจ · Verification Summary |
| Dynamic Document Requirements | `documentRequirements()` ตามประเภทผู้ประกอบการ หมวดสินค้า ผู้มีอำนาจ e-KYC และข้อมูลจาก Marketplace |
| Multi-Platform | เพิ่ม Marketplace ภายหลังจากหน้าร้าน (ร้านเดิม) · หลายแพลตฟอร์มต่อร้าน · Provenance + สถานะความเป็นเจ้าของต่อ Connection |
| Duplicate & Ownership | `shopClaim()` · กันซ้ำในบัญชีเดียวกัน · ร้านอื่นอ้าง Shop ID → `ownershipConflict` → MANUAL_REVIEW |
| Automation/Assessment Integration | ใช้ Decision Router และ Engine v2.1 เดิม · ประมวลผลหลังส่งคำขอลงทะเบียน · ร้านที่ไม่มี Marketplace ไม่ถูกหักคะแนน |
| Assessment Badge | ชื่อร้าน Band Coverage Confidence วันที่ แหล่งข้อมูล ลิงก์ตรวจสอบ Mock QR และสถานะ (รวม Outdated) |
| Homepage Executive | 8 Section ตามข้อกำหนด · 4 CTA ไปเส้นทางจริง · ไม่แสดง v1/v2 |
| Executive Presentation | Demo Center "เลือกตาม User Journey" + Demo แนะนำ · ประโยชน์ทางธุรกิจในตัวควบคุมการสาธิต |

สมมติฐานที่ตัดสินใจเอง:

26. **ยืนยันตัวตนเป็นข้อกำหนด "จำเป็น" แต่ทำผ่าน e-KYC** ไม่ใช่การแนบไฟล์ — ส่งคำขอได้ก่อนยืนยันตัวตน (ตามพฤติกรรมเดิม) และระบบแจ้งให้ร้านยืนยันเอง (AUTO_REQUEST_INFO)
27. **หลักฐานตามหมวดสินค้าเป็น "แนะนำ"** ไม่บังคับ — เป็นกฎจำลอง ข้อกำหนดจริงต้องตรวจกับหน่วยงานที่เกี่ยวข้อง
28. **Shop ID ซ้ำในบัญชีเดียวกันถูกกันที่หน้าจอ** · Shop ID ที่ร้านของผู้ประกอบการรายอื่นเชื่อมอยู่แล้วนำเข้าได้แต่ส่งเจ้าหน้าที่ — ระบบไม่เลือกเจ้าของหรือรวมร้านแทนเจ้าหน้าที่
29. **ปุ่ม "เข้าสู่ระบบ" ย้ายจาก Hero ไปที่ Header** ของหน้าแรก เพื่อให้ Hero มี 4 CTA ตามข้อกำหนด
