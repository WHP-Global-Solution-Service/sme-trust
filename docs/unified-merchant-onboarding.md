# Unified Merchant Onboarding — ลงทะเบียน 2 ช่องทาง · KYC · หลายแพลตฟอร์ม

> ต้นแบบ Frontend-only ด้วยข้อมูลจำลอง — ไม่เชื่อมต่อ Shopee, Lazada, DBD หรือ สคบ. จริง · ไม่เก็บเลขบัตรประชาชนหรือเอกสารจริง

## 1. ภาพรวม

ผู้ประกอบการเข้าสู่ SME Trust ได้ 2 ช่องทาง แต่ใช้ข้อมูลและ Workflow กลางชุดเดียว

| องค์ประกอบกลาง | ที่เก็บ / โค้ด |
|---|---|
| Merchant Profile | `useMerchantStore` (`Merchant` — `businessType`, `juristic`, `identityDocType`, `documents`) |
| Registration Application | `useVerificationStore` (`type: 'registration'`, `sourceDraftId` กันส่งซ้ำ) |
| Identity Record | `useOperatorStore` (`kycStatus`, `mockIdentityId` แสดงแบบปิดบัง `maskRef()`) |
| Marketplace Connections | `useMarketplaceStore` (หลาย Connection ต่อร้าน) |
| Trust Assessment | `useAssessmentStore` (Engine v2.1 เดิม) |
| Assessment Badge | `useAssessmentBadgeStore` (Automation First) |
| Audit History | `useAuditStore` |

## 2. Path A — Marketplace Connected Registration

`/m/register-shop/marketplace` → `/m/register-shop?from=import`

Select Marketplace → Mock Authorization (ไม่มีการขอรหัสผ่าน) → Auto Import (Preview ก่อนยืนยัน) → Auto-Fill → Review/Edit (ป้ายที่มาทุกช่อง) → Complete Missing Information → เอกสารตามกฎ → Preliminary Verification → ส่งคำขอเอง → ระบบประเมินอัตโนมัติ → Assessment Badge ตามเงื่อนไข

- รองรับ Shopee (จำลอง), Lazada (จำลอง) — โครงสร้าง `PLATFORMS` / `Platform` รองรับการเพิ่มแพลตฟอร์มอื่น
- ร้านในบัญชี Marketplace ที่เชื่อมกับร้านของบัญชีเดียวกันแล้ว **เลือกนำเข้าซ้ำไม่ได้** (แสดงร้านเดิมและลิงก์จัดการช่องทางขาย)

## 3. Path B — Direct Self-Registration

`/m/register-shop` (7 ขั้น): ประเภทธุรกิจ → ข้อมูลผู้ประกอบการ (ประเภทเอกสารยืนยันตัวตน / ข้อมูลนิติบุคคล) → ข้อมูลร้าน → ช่องทางขาย → เอกสารตามกฎ → ตรวจสอบ (Preliminary Verification) → ส่งคำขอ

- หลังส่ง ระบบประเมินอัตโนมัติทันที: ไม่มีข้อมูล Marketplace → **Insufficient Data พร้อมคำแนะนำ** · ไม่ถูกหักคะแนน (องค์ประกอบ C2–C4 ไม่ถูกนับ ไม่ใช่ศูนย์)
- คำขอลงทะเบียน (Level 2) ยังรอเจ้าหน้าที่ตามนโยบายเดิม

ทั้งสองช่องทาง: Save Draft · Refresh & Resume · Back/Next ไม่ทำข้อมูลหาย · ส่งซ้ำจากฉบับร่างเดิมได้ร้าน/คำขอเดิม (ไม่สร้างซ้ำ และไม่ประมวลผลซ้ำ)

## 4. KYC & Business Verification (จำลอง) — `src/features/onboarding/verification.ts`

| ประเภท | ข้อมูล | การตรวจ (จำลอง) |
|---|---|---|
| บุคคลธรรมดา | ชื่อ-นามสกุล · ประเภทเอกสารยืนยันตัวตน (บัตรประจำตัวประชาชน/หนังสือเดินทาง — จำลอง) · e-KYC · อีเมล · โทรศัพท์ · ที่อยู่ติดต่อ | e-KYC (ผล Mock) · Mock Reference แบบปิดบัง เช่น `OP-****-0012` · ความเป็นเจ้าของร้านบน Marketplace |
| นิติบุคคล | ชื่อบริษัท · เลขทะเบียนจำลอง (`DEMO-` + 13 หลัก) · ประเภทนิติบุคคล · ผู้มีอำนาจลงนาม · ผู้แทนที่สมัคร · ที่อยู่สถานประกอบการ · ติดต่อ | **Mock DBD** ตรวจรูปแบบเลขทะเบียนเท่านั้น (ระบุ "ไม่ได้ตรวจกับ DBD จริง") · หนังสือรับรอง · หนังสือมอบอำนาจเมื่อผู้สมัครไม่ใช่ผู้มีอำนาจ |

Verification Summary (`verificationSummary()`) แสดงในขั้นตรวจสอบก่อนส่ง หน้าร้านค้า (`/m/shop`) และหน้าคำขอของเจ้าหน้าที่ (`/o/applications/:id`) — รายการ: ตัวตน · การจดทะเบียน/หลักฐานธุรกิจ · ผู้แทน · ความเป็นเจ้าของร้านบน Marketplace · ช่องทางติดต่อ — สถานะ: ตรวจแล้ว (จำลอง) / รอตรวจสอบ / ขาด / ขัดแย้ง / ไม่จำเป็น

## 5. Dynamic Document Requirements — `documentRequirements()`

| เงื่อนไข | รายการ | ระดับ |
|---|---|---|
| ทุกประเภท | ยืนยันตัวตนผู้ประกอบการ — ครบอัตโนมัติเมื่อ e-KYC ผ่าน | จำเป็น (ทำผ่าน e-KYC ไม่ใช่การแนบไฟล์) |
| บุคคลธรรมดา | หลักฐานการประกอบธุรกิจอย่างน้อย 1 รายการ (ทะเบียนพาณิชย์ / ภาพสินค้า / ภาพสถานที่) | จำเป็น |
| นิติบุคคล | หนังสือรับรองนิติบุคคล | จำเป็น |
| นิติบุคคล + ผู้สมัครไม่ใช่ผู้มีอำนาจลงนาม | หนังสือมอบอำนาจ | จำเป็น |
| ทุกประเภท | หลักฐานช่องทางติดต่อ/ขาย — ครบอัตโนมัติเมื่อนำเข้าจาก Marketplace | แนะนำ |
| หมวดอาหารและเครื่องดื่ม / ความงามและสุขภาพ / อิเล็กทรอนิกส์ / ของเล่น | หลักฐานใบอนุญาต/จดแจ้ง/มาตรฐานผลิตภัณฑ์ (กฎจำลอง) | แนะนำ |

แสดงเฉพาะรายการที่เกี่ยวข้อง พร้อมข้อความ "รายการหลักฐานตามหมวดสินค้าเป็นกฎจำลองเพื่อการสาธิต — ข้อกำหนดจริงต้องได้รับการตรวจสอบจากหน่วยงานที่เกี่ยวข้อง"

## 6. Multi-Platform Merchant Management

- **สมัครเองแล้วเชื่อม Marketplace ภายหลัง:** หน้าร้าน → "เพิ่มช่องทางขาย (Marketplace)" → `/m/marketplace` → ยินยอม → เลือกร้าน → นำเข้า → เชื่อมกับร้านเดิม (ข้อความยืนยันว่าไม่สร้างบัญชี/ร้านใหม่) → ปรับ Coverage → ประเมินใหม่ → อัปเดต Badge อัตโนมัติ
- **มี Shopee แล้วเพิ่ม Lazada:** หลาย Connection ภายใต้ร้านเดียว · เชื่อมแพลตฟอร์มเดิมซ้ำได้ Connection เดิม
- ทุก Connection: แพลตฟอร์ม · Shop ID จำลอง · สถานะ · ซิงก์ล่าสุด · Raw Snapshot (อ่านอย่างเดียว) · ที่มาของข้อมูล · สถานะความเป็นเจ้าของร้าน (`ownershipOf()`)

### Duplicate & Ownership Prevention

| กรณี | การทำงาน |
|---|---|
| บัญชีเดียวกันเลือกร้านใน Marketplace ที่เชื่อมกับร้านของตนแล้ว | เลือกไม่ได้ — แนะนำให้จัดการช่องทางขายของร้านเดิม |
| Shop ID ถูกเชื่อมกับร้านของผู้ประกอบการรายอื่นแล้ว (`shopClaim()`) | นำเข้าได้แต่บันทึก `ownershipConflict` → Decision Router ส่ง MANUAL_REVIEW (งานเดียว · Evidence Snapshot) · ร้านที่เชื่อมอยู่ก่อนไม่ได้รับผลกระทบ |
| ชื่อร้านเหมือนกัน | ไม่รวมร้าน — เทียบที่ Shop ID เท่านั้น |
| ชื่อเจ้าของบัญชีไม่ตรงกับผู้ยืนยันตัวตน | MANUAL_REVIEW (Identity Mismatch) |
| เจ้าหน้าที่ไม่อนุมัติความเป็นเจ้าของ | ข้อมูลจากการเชื่อมต่อนั้นไม่ถูกใช้ประเมิน · ใบรับรองไม่เปลี่ยน |

## 7. Data Provenance

ข้อมูลแยกเป็น Raw Marketplace Data (อ่านอย่างเดียว) · Merchant Editable Profile · Identity Verification · Evidence Records · Assessment Results — สถานะที่มาของช่องข้อมูล: นำเข้า / ผู้สมัครแก้ไข / กรอกเอง / ขาด / รอการตรวจสอบ / ตรงกับต้นฉบับ (ตรวจสอบอัตโนมัติ) · ความขัดแย้งของตัวตน/ความเป็นเจ้าของแสดงใน Verification Summary และส่งเจ้าหน้าที่ · การแก้ชื่อร้าน/หมวดไม่เปลี่ยนคะแนน รีวิว ยอดขาย ราคา หรือ Snapshot

## 8. การเชื่อมกับ Automation First และ Trust Assessment

ใช้ Decision Router และ Engine v2.1 เดิม (ไม่เปลี่ยนสูตรหรือน้ำหนัก) — เพิ่มเฉพาะ: ประมวลผลหลังส่งคำขอลงทะเบียน · กรณี Shop ID ถูกอ้างโดยร้านอื่น · ข้อความแนะนำสำหรับร้านที่ไม่มี Marketplace

## 9. ข้อจำกัด

ดู `docs/known-issues.md` (KI-V2-28 ถึง KI-V2-31)
