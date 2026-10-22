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
