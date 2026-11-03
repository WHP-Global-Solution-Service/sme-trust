# SME Trust Platform v2 — แผนพัฒนา

> Branch: `sme-trustv.2` (แยกจาก `main` ที่ commit `4027c04` — v1 ฉบับสมบูรณ์ล่าสุดที่ Deploy บน GitHub Pages แล้ว)
> สถานะ: **แผนงาน — ยังไม่ได้พัฒนา Feature ใหม่** · ใช้เป็นฐานสำหรับ Prompt 3.6

หลักการที่ไม่เปลี่ยนจาก v1: **Frontend-only, Mock Data, Rule-based Simulation** — ไม่มี Backend, Database, API ภายนอก, AI Model จริง หรือการเชื่อมต่อแพลตฟอร์มจริง ข้อมูลทั้งหมดเป็นข้อมูลสมมติในเบราว์เซอร์ และทุกหน้าต้องแสดงว่าเป็นระบบสาธิต

---

## 1. เป้าหมายและ Concept ใหม่

### จาก "ตรวจเอกสาร" สู่ "ประเมินจากพฤติกรรมการขายจริง (จำลอง)"

| | v1 (ปัจจุบัน) | v2 (เป้าหมาย) |
|---|---|---|
| แหล่งข้อมูลความน่าเชื่อถือ | ตัวตน (e-KYC), เอกสารธุรกิจ, ประวัติร้องเรียน/คำเตือน | v1 **+** ข้อมูลการขายบน Marketplace (ราคา ยอดขาย รีวิว การจัดส่ง) จากหลายแพลตฟอร์ม |
| ผลลัพธ์ | Trust Level 0–4 + ใบรับรอง | v1 **+** Trust Assessment ที่ปรับตามความเสี่ยง พร้อม **ระดับความครอบคลุมข้อมูลและความเชื่อมั่น** และ **คำอธิบายทุกปัจจัย** |
| ใครตัดสิน | เจ้าหน้าที่อนุมัติตาม Checklist | ระบบ **เสนอ** ความเหมาะสมของ Badge → **เจ้าหน้าที่ตัดสิน** (Human-in-the-loop เสมอ) |
| ร้านใหม่ที่ข้อมูลน้อย | ได้ระดับตามเอกสาร | ได้สถานะ **"ข้อมูลยังไม่เพียงพอ"** — ไม่ถูกลงโทษเพราะเป็นร้านใหม่ |

### Concept หลัก

1. **Evidence-based Trust** — ความน่าเชื่อถือคำนวณจากหลักฐานหลายแหล่ง ไม่ใช่เอกสารอย่างเดียว
2. **Risk-adjusted** — คะแนนรวมถูกปรับด้วยสัญญาณความเสี่ยง (เช่น ราคาต่ำผิดปกติ รีวิวผิดธรรมชาติ ข้อร้องเรียนร้ายแรง) และมี "เพดาน" เมื่อมีมาตรการที่เปิดอยู่
3. **Coverage & Confidence** — ทุกผลประเมินบอกว่าใช้ข้อมูลมากน้อยแค่ไหน และมั่นใจได้ระดับใด
4. **Explainable** — ทุกผลต้องอธิบายได้: ปัจจัยใด ค่าเท่าไร มาจากข้อมูลใด และร้านควรปรับปรุงอะไร
5. **Human Decision** — ระบบไม่ให้ Badge, ไม่ระงับ, ไม่ขึ้นบัญชีดำอัตโนมัติ เจ้าหน้าที่ตัดสินและบันทึกเหตุผลเสมอ

---

## 2. รายการฟีเจอร์ที่จะเพิ่ม

| # | ฟีเจอร์ | รายละเอียด | ผู้ใช้หลัก |
|---|---|---|---|
| F1 | **Multi-Platform Marketplace Connection Simulation** | เชื่อมร้านกับ Marketplace แบบจำลอง: เลือกแพลตฟอร์ม → หน้าขอความยินยอมจำลอง (ระบุขอบเขตข้อมูล) → รหัสร้านจำลอง → จำลองการซิงก์ (มีสถานะกำลังซิงก์/สำเร็จ/ล้มเหลว) · จัดการการเชื่อมต่อ: ซิงก์ใหม่, ยกเลิกการเชื่อมต่อ (ข้อมูลจากแพลตฟอร์มนั้นถูกลบออกจากการประเมิน) | ผู้ประกอบการ |
| F2 | **Shopee / Lazada Mock Data** | ข้อมูลสมมติต่อร้าน: รายการสินค้า, ราคาและประวัติราคา, ยอดขายรายเดือน, อัตรายกเลิก/คืนสินค้า, การจัดส่งตรงเวลา, อัตราตอบแชต, คะแนนและรีวิวตัวอย่าง, อายุร้าน — สร้างแบบ **Deterministic** (Seed เดิม = ข้อมูลเดิมทุกครั้ง) | ทุกบทบาท |
| F3 | **Merchant Self-Registration** | ต่อยอดการลงทะเบียน v1: ร้านเลือก "นำเข้าข้อมูลร้านจาก Marketplace" เพื่อเติมข้อมูลร้านอัตโนมัติ (ยังแก้ไขได้) ก่อนยื่นคำขอ · ยังคงเส้นทางกรอกเองแบบ v1 | ผู้ประกอบการ |
| F4 | **Price & Sales Volume Analysis** | เทียบราคากับช่วงอ้างอิงของหมวดสินค้า (จำลอง), ตรวจราคาต่ำผิดปกติ/กระโดด, ยอดขายพุ่งไม่สอดคล้องกับอายุร้าน, ความสม่ำเสมอของยอดขาย, อัตรายกเลิก/คืนสินค้า | ระบบ → ร้าน/เจ้าหน้าที่ |
| F5 | **Review & Rating Analysis** | การกระจายคะแนน, จำนวนและความใหม่ของรีวิว, สัญญาณรีวิวผิดธรรมชาติ (รีวิวจำนวนมากในช่วงสั้น, ข้อความซ้ำ/สั้นผิดปกติ), ประเด็นเชิงลบที่พบบ่อย (ใช้คำสำคัญเดียวกับ AI-02), ความขัดแย้งระหว่างคะแนนกับข้อร้องเรียน | ระบบ → ร้าน/เจ้าหน้าที่ |
| F6 | **Risk-Adjusted Trust Assessment Engine** | Pure Function: รวมคะแนน 5 องค์ประกอบ → ปรับด้วยสัญญาณความเสี่ยง → เพดานจากมาตรการที่เปิดอยู่ → ระดับผลประเมิน (A–D / ข้อมูลไม่เพียงพอ) | ระบบ |
| F7 | **Data Coverage & Confidence Indicators** | แสดงความครอบคลุมข้อมูล (แพลตฟอร์มที่เชื่อม, จำนวนเดือน, จำนวนรีวิว/คำสั่งซื้อ, ความใหม่ของข้อมูล) และความเชื่อมั่น สูง/กลาง/ต่ำ ทุกจุดที่แสดงผลประเมิน | ทุกบทบาท |
| F8 | **Explainable Trust Assessment** | รายการปัจจัย: ค่า, ผลต่อคะแนน (+/−), หลักฐาน, แหล่งข้อมูล, คำแนะนำการปรับปรุง · มุมผู้บริโภคเห็นสรุปที่เข้าใจง่ายโดยไม่เปิดเผยข้อมูลเชิงพาณิชย์ของร้าน | ร้าน / ผู้บริโภค / เจ้าหน้าที่ |
| F9 | **Officer Review & Badge Eligibility** | คิวงานผลประเมินใหม่ → เจ้าหน้าที่ดูรายละเอียด → อนุมัติ Badge / ขอข้อมูลเพิ่ม / ไม่อนุมัติ / ส่งพิจารณาความเสี่ยง — การตัดสินที่ต่างจากข้อเสนอของระบบต้องมีเหตุผล (Audit Log) | เจ้าหน้าที่ |
| F10 | **Full Journey Demo v2** | เรื่องราวสาธิตใหม่ตั้งแต่ร้านลงทะเบียนเอง → เชื่อม 2 แพลตฟอร์ม → วิเคราะห์ → เจ้าหน้าที่ตัดสิน → ผู้บริโภคเห็นผล + กรณีเปรียบเทียบ (ร้านใหม่ข้อมูลน้อย, ร้านมีสัญญาณเสี่ยง) | ผู้นำเสนอ |

### ข้อตกลงเรื่องชื่อแพลตฟอร์ม (ต้องยืนยันก่อน Phase 2)

ข้อกำหนดระบุ Shopee / Lazada แนะนำให้ **แสดงชื่อพร้อมป้าย "(จำลอง)" ทุกครั้ง ไม่ใช้โลโก้ สีแบรนด์ หรือ URL ร้านจริง** และมีข้อความชัดเจนว่าไม่ได้เชื่อมต่อหรือได้รับความร่วมมือจากแพลตฟอร์มจริง ชื่อเก็บใน Config ที่เดียว (`PLATFORMS`) เพื่อเปลี่ยนเป็นชื่อกลาง เช่น "Marketplace A/B" ได้ทันทีหากต้องการ

---

## 3. ส่วนของระบบเดิมที่จะนำกลับมาใช้

v2 **ต่อยอด ไม่แทนที่** — ทุกฟังก์ชัน v1 ยังอยู่และต้องผ่าน Test เดิมทั้งหมด

| ส่วนเดิม | ไฟล์หลัก | การใช้ใน v2 |
|---|---|---|
| Registration / OTP / e-KYC | `features/onboarding/*` | จุดเริ่มต้นของ Self-Registration (ไม่แก้ Flow เดิม) |
| ลงทะเบียนร้าน 7 ขั้น | `features/merchants/RegisterShopWizard.tsx` | เพิ่มตัวเลือก "นำเข้าจาก Marketplace" เป็นทางเลือก (เส้นทางเดิมยังใช้ได้) |
| Merchant Verification / Application | `features/verification/*`, `approveApplication()` | คำขอ Badge จากผลประเมินใช้ `VerificationApplication` type `certification` + อ้างอิง `assessmentId` |
| Trust Level, ใบรับรอง, Badge, QR | `utils/trust.ts`, `utils/criteria.ts`, `components/common/Trust.tsx` | ผลประเมิน v2 เป็น **เกณฑ์เพิ่มเติม** ของ Level 3–4 · Badge/QR เดิมแสดงผลประเมินและ Coverage เพิ่ม |
| Consumer Verification | `features/consumers/*` | หน้าร้าน/หน้าตรวจใบรับรองแสดงสรุปผลประเมิน + ความครอบคลุมข้อมูล |
| Complaint Center / Merchant Resolution | `features/complaints/*`, `features/resolution/*` | สถิติข้อร้องเรียน (แก้ไขสำเร็จ/ส่งต่อ/ร้ายแรง) เป็นองค์ประกอบ "ประวัติการปฏิบัติตาม" |
| Warning & Training | `features/warnings/*`, `features/training/*` | คำเตือนค้าง = สัญญาณความเสี่ยง · การอบรม = ปัจจัยบวก · คำแนะนำการปรับปรุงลิงก์ไปหลักสูตร |
| Risk / Suspension / Appeal | `features/risk/*`, `riskAction()` | ระงับ/เพิกถอน/เรื่องเปิดอยู่ = **เพดาน** ผลประเมิน · เจ้าหน้าที่ส่งร้านที่มีสัญญาณเสี่ยงเข้า Risk Review เดิม |
| AI Advertising Checker | `features/ai-assistant/services/advertisingAnalyzer.ts` | ตรวจคำบรรยายสินค้าที่นำเข้าจาก Marketplace (ข้อกล่าวอ้างเกินจริง) |
| AI Complaint Assistant | `rules/complaintRules.ts`, `complaintAnalyzer.ts` | ใช้คำสำคัญ/การจัดประเภทเดิมจัดกลุ่มประเด็นเชิงลบในรีวิว |
| Store / Workflow / Audit | `createEntityStore`, `stores/workflows.ts`, `useAuditStore` | Store ใหม่ใช้รูปแบบเดิม · ทุกการเปลี่ยนแปลงผ่าน Workflow + Audit |
| Demo Controller | `demo/controller.ts`, `mock/scenarios/*`, `DemoController.tsx` | Scenario v2 ใช้ Controller, Gate, Role Transition, Continuity, Snapshot เดิม |
| Test Harness | `tests/harness.mts`, `tests/e2e/helpers.ts`, `flows.ts` | ใช้กับ Test v2 ทั้งหมด |
| Design System | `components/common/ui.tsx`, Tailwind tokens | Component ใหม่ใช้ Token เดิม (สีผ่าน WCAG AA แล้ว) |

**Demo Scenario 1–8 และ Full Journey v1 คงไว้ตามเดิม** — v2 เพิ่มเรื่องใหม่ ไม่เปลี่ยนลำดับหรือเนื้อหาเรื่องเดิม

---

## 4. Mock Data Architecture

### หลักการออกแบบ

- **เก็บน้อย คำนวณซ้ำได้** — localStorage เก็บเฉพาะ "การเชื่อมต่อ + Seed + โปรไฟล์ร้าน (Archetype)" ส่วนข้อมูลการขายรายละเอียดสร้างด้วย Generator แบบ Deterministic เมื่อต้องใช้ (Memoize) → ขนาด localStorage เล็ก, Reset ง่าย, ผลซ้ำได้ 100%
- **ไม่แตะรูปแบบข้อมูล v1** — เพิ่มเฉพาะ Field แบบ Optional และ Store ใหม่ ข้อมูล v1 ที่ผู้ใช้มีอยู่ยังโหลดได้ (ทดสอบด้วย localStorage รูปแบบ v1)
- **ทุกอย่างผ่าน Workflow** — เชื่อม/ซิงก์/ยกเลิก/ประเมิน/ตัดสิน → `stores/workflows.ts` + Audit + Notification

### Store ใหม่ (`createEntityStore`, key `smetrust:v1:<name>` — รวมใน `domainStores` เพื่อ Reset/Export)

| Store | ข้อมูลหลัก |
|---|---|
| `useMarketplaceStore` (`marketplace-connections`) | `id`, `merchantId`, `platform` (`shopee` \| `lazada`), `mockShopId`, `status` (`pending_consent` \| `syncing` \| `connected` \| `sync_failed` \| `disconnected`), `scopes[]`, `consentAt`, `lastSyncAt`, `seed`, `archetype` |
| `useAssessmentStore` (`trust-assessments`) | `id`, `merchantId`, `modelVersion`, `computedAt`, `inputsHash`, ผลลัพธ์ (`score`, `band`, `confidence`, `coverage`, `components`, `factors`, `flags`), `status` (`draft` \| `pending_review` \| `decided`), `officerDecision` (`approved` \| `rejected` \| `need_info` \| `escalated`, `reason`, `officerId`, `at`) |

### Generator (Pure, Deterministic)

```
src/features/marketplace/
  data/platforms.ts        PLATFORMS (ชื่อแสดงผล + "(จำลอง)"), ขอบเขตข้อมูลที่ขอความยินยอม
  data/categoryBenchmarks.ts  ช่วงราคาอ้างอิงต่อหมวดสินค้า (จำลอง)
  data/archetypes.ts       โปรไฟล์ร้านต้นแบบ
  services/prng.ts         Seeded PRNG (mulberry32) — ไม่มี Math.random ในการสร้างข้อมูล
  services/generator.ts    generateSnapshot(connection, now) → MarketplaceSnapshot
```

`MarketplaceSnapshot` (ไม่ persist): `shopAgeMonths`, `listings[]` (ชื่อ, หมวด, ราคา, ประวัติราคา 6 เดือน, คำบรรยาย), `monthlyOrders[12]`, `cancelRate`, `returnRate`, `onTimeShipRate`, `chatResponseRate`, `ratingHistogram[1..5]`, `reviews[]` (ตัวอย่าง ≤ 30 รายการ: คะแนน, ข้อความ, วันที่), `followers`

### Archetypes (ครอบคลุมทุกกรณีที่ต้องสาธิตและทดสอบ)

| Archetype | ลักษณะข้อมูล | ผลที่คาดหวัง |
|---|---|---|
| `established_good` | ขายมา 24+ เดือน ยอดสม่ำเสมอ รีวิวดี คืนสินค้าต่ำ | A — ความเชื่อมั่นสูง |
| `growing_ok` | 8–12 เดือน ยอดโตปกติ รีวิวดีแต่น้อย | B — ความเชื่อมั่นกลาง |
| `new_shop` | < 3 เดือน คำสั่งซื้อและรีวิวน้อยมาก | **ข้อมูลไม่เพียงพอ** (ไม่ใช่ D) |
| `price_anomaly` | สินค้าแบรนด์ราคาต่ำกว่าช่วงอ้างอิง > 50% | สัญญาณเสี่ยงด้านราคา → C/D |
| `review_burst` | รีวิว 5 ดาวจำนวนมากในไม่กี่วัน ข้อความสั้นซ้ำกัน | สัญญาณรีวิวผิดธรรมชาติ + ลดความเชื่อมั่น |
| `fulfillment_issue` | ยกเลิก/คืนสูง จัดส่งล่าช้า | องค์ประกอบผลการขายต่ำ |
| `sales_spike` | ยอดพุ่ง 10 เท่าในเดือนเดียว ร้านอายุน้อย | สัญญาณผิดปกติ → แนะนำให้เจ้าหน้าที่ตรวจ |

### การผูกกับข้อมูล v1 (Seed)

ร้านตัวอย่าง 12 ร้านของ v1 ได้ Archetype ที่สอดคล้องกับเรื่องเดิม เช่น M-001 บ้านผ้าคราม → `established_good` (Shopee + Lazada), M-005 ร้านกาแฟดอยสูง → `growing_ok`, M-004 ไอทีแกดเจ็ตช็อป → `fulfillment_issue` (สอดคล้องข้อร้องเรียนไม่ได้รับสินค้า), M-008/M-012 → `review_burst`/`price_anomaly` (สอดคล้องกรณีเพิกถอน/ตัวตนซ้ำ), ร้านที่ยังไม่เชื่อมต่อคงเดิม — ตรวจความสอดคล้องด้วย `tests/integrity.mts`

### localStorage / Version

- Prefix เดิม `smetrust:v1:` เพื่อให้ Reset/Export/Corrupt-data guard เดิมครอบคลุม Store ใหม่ทันที
- `merge` ของ `createEntityStore` (ตรวจรูปแบบแล้วใช้ Seed แทนเมื่อเสียหาย) ใช้กับ Store ใหม่เช่นกัน
- ผลประเมินเก็บ `modelVersion` + `inputsHash` — เปลี่ยนกฎ/ข้อมูลเมื่อใด UI แสดง "ผลประเมินล้าสมัย — ประเมินใหม่"

---

## 5. Trust Assessment Model

Pure Function `assessTrust(input, model = MODEL_V2)` ใน `src/features/trust-assessment/` — ไม่แตะ Store, ทดสอบได้โดยตรง, Model (น้ำหนัก/เกณฑ์) แยกเป็น Config ที่อ่านได้

### 5.1 องค์ประกอบ (คะแนนย่อย 0–100 ต่อองค์ประกอบ)

| องค์ประกอบ | น้ำหนัก | ข้อมูลที่ใช้ |
|---|---|---|
| C1 ตัวตนและธุรกิจ | 25% | e-KYC, การอนุมัติร้าน, ใบรับรอง, ช่องทางขายที่ยืนยันแล้ว (v1) |
| C2 ผลการขายและการจัดส่ง | 25% | ความสม่ำเสมอของยอดขาย, อายุร้าน, อัตรายกเลิก/คืน, จัดส่งตรงเวลา, อัตราตอบแชต (Marketplace) |
| C3 เสียงลูกค้า | 20% | คะแนนเฉลี่ยแบบถ่วงความใหม่, จำนวนรีวิว, คุณภาพรีวิว, ประเด็นเชิงลบ (Marketplace) |
| C4 ความสมเหตุสมผลของราคา | 10% | ราคาเทียบช่วงอ้างอิง, การเปลี่ยนราคาผิดปกติ (Marketplace) |
| C5 การปฏิบัติตามและการแก้ไขปัญหา | 20% | อัตราแก้ไขข้อร้องเรียนสำเร็จ, เรื่องที่ส่งต่อ, คำเตือนที่แก้แล้ว/ค้าง, การอบรม (v1) |

องค์ประกอบที่ **ไม่มีข้อมูล** ไม่ถูกนับเป็น 0 — น้ำหนักกระจายไปยังองค์ประกอบที่มีข้อมูล และลดความครอบคลุม (Coverage) แทน

### 5.2 ขั้นตอนคำนวณ

1. **Base Score** = ผลรวมถ่วงน้ำหนักขององค์ประกอบที่มีข้อมูล (0–100)
2. **Risk Adjustment** — หักตามสัญญาณความเสี่ยงที่ตรวจพบ (แต่ละสัญญาณมีน้ำหนักและหลักฐาน) เช่น ราคาต่ำผิดปกติ −10, รีวิวผิดธรรมชาติ −8, ยอดขายพุ่งผิดปกติ −5, ข้อร้องเรียนร้ายแรงที่ยังเปิด −15 (ค่าจริงกำหนดใน Phase 4 พร้อม Test)
3. **Hard Caps** (จาก v1 — ไม่มีคะแนนใดชดเชยได้): ใบรับรองถูกเพิกถอน → D, ถูกระงับ/มีเรื่องพิจารณาความเสี่ยงเปิดอยู่ → ไม่เกิน C, ยังไม่ยืนยันตัวตน → ไม่เกิน C
4. **Coverage** (0–100%) = สัดส่วนข้อมูลที่มีต่อข้อมูลที่คาดหวัง: จำนวนแพลตฟอร์ม, เดือนที่มีข้อมูล (เป้า 12), คำสั่งซื้อ (เป้า 100), รีวิว (เป้า 30), ความใหม่ของการซิงก์ (≤ 30 วัน)
5. **Confidence**: สูง (Coverage ≥ 70% และไม่มีสัญญาณที่ทำให้ข้อมูลน่าสงสัย) / กลาง (40–69%) / ต่ำ (< 40% หรือพบรีวิวผิดธรรมชาติ)
6. **Band**

| Band | เงื่อนไข | ความหมายที่แสดง |
|---|---|---|
| A | คะแนน ≥ 80 และความเชื่อมั่นไม่ต่ำ | น่าเชื่อถือสูง |
| B | 65–79 | น่าเชื่อถือ |
| C | 50–64 หรือถูกจำกัดเพดาน | ควรติดตาม |
| D | < 50 หรือถูกเพิกถอน | มีความเสี่ยงสูง |
| — | ความเชื่อมั่นต่ำเพราะข้อมูลน้อย (ไม่ใช่เพราะข้อมูลน่าสงสัย) | **ข้อมูลยังไม่เพียงพอ** — ไม่ใช่ผลลบ |

### 5.3 Explainability (ผลลัพธ์ทุกครั้งต้องมี)

```ts
interface TrustFactor {
  id: string;            // เช่น 'c3.rating_recency', 'risk.review_burst'
  component: 'C1'|'C2'|'C3'|'C4'|'C5'|'risk'|'cap';
  label: string;         // ภาษาไทย อ่านเข้าใจได้
  value: string;         // เช่น "4.7 ดาว จาก 1,240 รีวิว (12 เดือน)"
  impact: number;        // ผลต่อคะแนน (+/−)
  evidence: string[];    // ข้อมูลที่ใช้ เช่น เดือนที่ยอดพุ่ง, สินค้าที่ราคาต่ำ
  source: 'identity' | 'shopee' | 'lazada' | 'complaints' | 'warnings' | 'training' | 'risk';
  improve?: string;      // คำแนะนำ เช่น "เชื่อมต่อ Lazada เพื่อเพิ่มความครอบคลุมข้อมูล"
}
```

- มุมร้านค้า: ทุกปัจจัย + คำแนะนำการปรับปรุง (ลิงก์ไปหลักสูตรอบรม/AI ตรวจโฆษณา)
- มุมผู้บริโภค: Band, Coverage, Confidence และสรุปภาษาง่าย 3–5 ข้อ **ไม่แสดงยอดขาย/ข้อมูลเชิงพาณิชย์ของร้าน** และไม่แสดงข้อกล่าวหาที่ยังไม่มีข้อสรุป (หลักเดียวกับ v1)
- มุมเจ้าหน้าที่: ทุกปัจจัย + หลักฐานดิบ + ประวัติผลประเมินแต่ละ Version

### 5.4 Badge Eligibility และการตัดสินของเจ้าหน้าที่

| ข้อเสนอของระบบ | เงื่อนไข |
|---|---|
| **เสนอให้ได้ Badge Trusted SME (L3)** | Band A/B + ความเชื่อมั่นสูง/กลาง + เกณฑ์ v1 ระดับ 3 ครบ |
| **ขอข้อมูลเพิ่ม** | ข้อมูลยังไม่เพียงพอ หรือความเชื่อมั่นต่ำ |
| **ยังไม่เหมาะสม** | Band C/D |
| **ควรส่งพิจารณาความเสี่ยง** | พบสัญญาณร้ายแรง (เช่น ราคาต่ำผิดปกติ + ข้อร้องเรียนไม่ได้รับสินค้า) |

เจ้าหน้าที่เลือก: อนุมัติ / ขอข้อมูลเพิ่ม / ไม่อนุมัติ / ส่ง Risk Review (v1) — ตัดสินต่างจากข้อเสนอได้แต่ต้องมีเหตุผล · อนุมัติแล้วออก/ยกระดับใบรับรองผ่าน `approveApplication()` เดิม · ไม่มีการลด Badge หรือระงับอัตโนมัติจากคะแนน

### 5.5 ข้อจำกัดที่ต้องแสดง

ผลประเมินเป็น **การจำลองด้วยกฎ** จากข้อมูลสมมติ ไม่ใช่คะแนนเครดิต ไม่ใช่การรับรองทางกฎหมาย ไม่ใช่บัญชีดำ และไม่ได้ใช้ข้อมูลจริงจาก Shopee/Lazada

---

## 6. Demo Flow v2

เพิ่มในหน้ารวม `/demo` เป็นแท็บ **"Full Journey v2"** คู่กับ Journey v1 เดิม (Scenario 1–8 ไม่เปลี่ยน) — ใช้ Demo Controller, Gate, Role Transition และ Continuity เดิม

| Scenario | เรื่อง | บทบาท | Action สำคัญ (Gate) |
|---|---|---|---|
| **9** | ร้านลงทะเบียนเองและเชื่อม Marketplace | ผู้ประกอบการ | ลงทะเบียน (ใช้ S1 เดิมหรือบัญชีตัวอย่าง) → เชื่อม Shopee (จำลอง) → ให้ความยินยอม → ซิงก์สำเร็จ → เชื่อม Lazada (จำลอง) → นำเข้าข้อมูลร้านในแบบฟอร์มลงทะเบียน → ยื่นคำขอ |
| **10** | วิเคราะห์ราคา ยอดขาย และรีวิว | ผู้ประกอบการ | ดูผลวิเคราะห์ + Coverage/Confidence → ดูปัจจัยและคำแนะนำ → (ทางเลือก) แก้คำบรรยายสินค้าด้วย AI ตรวจโฆษณา |
| **11** | เจ้าหน้าที่ตรวจผลประเมินและตัดสิน Badge | เจ้าหน้าที่ | เปิดคิว → ดูปัจจัย/หลักฐาน → อนุมัติ Badge (หรือตัดสินต่างพร้อมเหตุผล) → ร้านได้แจ้งเตือน |
| **12** | ผู้บริโภคตรวจสอบร้านที่ใช้ข้อมูลหลายแพลตฟอร์ม | ผู้บริโภค | ค้นหา/สแกน QR → เห็น Band + "ข้อมูลจาก 2 แพลตฟอร์ม 14 เดือน" → สรุปเหตุผลภาษาง่าย |
| **13** | กรณีเปรียบเทียบ: ร้านใหม่ vs ร้านมีสัญญาณเสี่ยง | เจ้าหน้าที่ / ผู้บริโภค | ร้านใหม่ได้ "ข้อมูลยังไม่เพียงพอ" (ไม่ถูกลงโทษ) · ร้านราคาต่ำผิดปกติ + รีวิวผิดธรรมชาติ → เจ้าหน้าที่ส่ง Risk Review (ต่อกับกระบวนการ S6 เดิม) |

**Full Journey v2** = 9 → 10 → 11 → 12 → 13 ด้วยบัญชี/ร้านเดียวกันใน 9–12 (Context ID: `operatorId`, `merchantId`, `connectionIds`, `assessmentId`) · S13 เป็นกรณีศึกษาแยกที่แจ้งก่อนเริ่ม (กลไก caseNote/Continuity เดิม) · จบด้วยหน้าสรุปภาพรวม v2

---

## 7. Implementation Phases

ทุก Phase จบเมื่อ: `npm test` ผ่าน (รวม v1 ทั้งหมด), `tsc` ผ่าน, E2E ที่เกี่ยวข้องผ่าน, เอกสารอัปเดต — ไม่ Push/Merge/Deploy จนกว่าจะได้รับคำสั่ง

| Phase | ขอบเขต | ผลลัพธ์ที่ตรวจได้ |
|---|---|---|
| **P0** ✅ | สร้าง Branch, ตรวจ Architecture, แผนนี้ | `docs/sme-trust-v2-plan.md` |
| **P1 Data Foundation** | Types, PRNG, Generator, Archetypes, Category Benchmarks, Store ใหม่, Seed ผูกร้าน v1, รวมใน Reset/Export, Integrity | Unit test: Deterministic, Archetype ให้ข้อมูลตามลักษณะ, Reset ตรง Seed, localStorage v1 ยังโหลดได้ |
| **P2 Connection & Self-Registration** | หน้าเชื่อม Marketplace (ความยินยอม, ซิงก์, จัดการ/ยกเลิก), นำเข้าข้อมูลใน Wizard เดิม, Workflow + Audit + Notification | Workflow test + E2E เชื่อม/ยกเลิก/นำเข้า |
| **P3 Analysis Engines** | Price & Sales, Review & Rating (ใช้คำสำคัญ AI-02) — Pure Function | Unit test ต่อ Archetype + กรณีขอบ |
| **P4 Trust Assessment Engine** | Components, Risk Adjustment, Caps, Coverage, Confidence, Band, Factors, Badge Eligibility | Unit test + Invariants (หัวข้อ 8) |
| **P5 UI** | หน้าผลประเมินของร้าน, การแสดงผลในมุมผู้บริโภค/QR, คิวและหน้าตัดสินของเจ้าหน้าที่, KPI ใหม่ใน Admin Dashboard | Render test ทุกเส้นทางใหม่ + E2E ข้ามบทบาท |
| **P6 Demo v2** | Scenario 9–13, Full Journey v2, หน้าสรุป v2 | Scenario test (Node) + E2E Journey v2 |
| **P7 QA & Regression** | Responsive, Safari, Sub-path, พิสูจน์อักษร, เอกสาร (UAT v2) | ทุก Suite v1 + v2 ผ่าน, UAT Report v2 |

ลำดับนี้ทำให้ Logic (P1, P3, P4) ทดสอบได้ก่อนมี UI และ v1 ไม่ถูกแตะจนถึง P2

---

## 8. Test Strategy

| ระดับ | สิ่งที่ทดสอบ | ไฟล์ |
|---|---|---|
| Unit (Pure) | Generator Deterministic, Archetype → ลักษณะข้อมูล, Price/Sales/Review Analysis, Assessment | `tests/v2/marketplace.test.mts`, `tests/v2/assessment.test.mts` |
| **Invariants** | คะแนน 0–100 เสมอ · เพิ่มข้อร้องเรียนส่งต่อ → คะแนนไม่เพิ่ม · ยกเลิกการเชื่อมต่อ → Coverage ไม่เพิ่ม · ร้านถูกเพิกถอน → D เสมอ · ข้อมูลน้อย → "ข้อมูลยังไม่เพียงพอ" ไม่ใช่ D · Input เดิม → ผลเดิม · ทุกผลมี Factor ที่อธิบายผลรวมได้ | `tests/v2/assessment.test.mts` |
| Workflow / Integrity | เชื่อม/ซิงก์/ยกเลิก/ประเมิน/ตัดสิน → Store, Audit, Notification ตรงกันทุกบทบาท · FK ของ Store ใหม่ | `tests/flows.test.mts` (ขยาย), `tests/integrity.mts` |
| Render | ทุกเส้นทางใหม่ × บทบาท ไม่มี Error, Role Gate ถูกต้อง | `tests/render.test.mts` |
| Scenario | Scenario 9–13 + Full Journey v2 ผ่าน Controller (Gate, Transition, Continuity, Restart, Refresh) | `tests/scenarios.test.mts` |
| E2E | เชื่อมต่อ → ประเมิน → เจ้าหน้าที่ตัดสิน → ผู้บริโภคเห็นผล, Journey v2 | `tests/e2e/v2-*.spec.ts` (Chromium + Safari + Sub-path) |
| ภาษาไทย | กฎพิสูจน์อักษรเดิมครอบคลุมข้อความใหม่อัตโนมัติ | `tests/thai.test.mts` |
| **Regression v1** | ทุก Suite เดิม (`npm test` 482 เงื่อนไข + Render 78 เส้นทาง, E2E Chromium 47 + Safari 61) ต้องผ่านทุก Phase | เดิม |

---

## 9. GitHub Pages Compatibility

- **ไม่มี Network** — ข้อมูล Marketplace สร้างในเบราว์เซอร์ด้วย Seeded Generator ไม่มี `fetch`/API (ตรวจด้วยการสแกนโค้ดเดิม)
- **Base path** — ใช้ `appPath()` / `appUrl()` / Router `basename` เดิม ทุกลิงก์และ QR ใหม่ต้องผ่าน Test "Base path" เดิม
- **ขนาด Bundle** — v2 เพิ่มโค้ดมาก แนะนำแยกหน้า v2 ด้วย `React.lazy` (Code-split) ซึ่งช่วยแก้ KI-04 ด้วย · Asset ทั้งหมด Bundle ภายใน ไม่ใช้โลโก้แพลตฟอร์มจากภายนอก
- **localStorage** — เก็บเฉพาะการเชื่อมต่อ/ผลประเมิน (ข้อมูลรายละเอียดคำนวณซ้ำ) เป้าหมายรวมทั้งระบบ < 1 MB
- **Deploy** — Workflow ปัจจุบัน Deploy เฉพาะ `main` → งานบน `sme-trustv.2` **ไม่กระทบเว็บ v1 ที่ใช้งานอยู่** ทดสอบ v2 ในเครื่องด้วย `npm run test:e2e:subpath`
- **ทางเลือกเผยแพร่ v2 (ต้องตัดสินใจภายหลัง)**: (ก) Merge เข้า `main` เมื่อพร้อม — v2 แทนที่ v1 ที่ URL เดิม (v1 ยังอยู่ในระบบเพราะไม่ได้ลบฟีเจอร์) หรือ (ข) Build v2 ไว้ที่ `/sme-trust/v2/` ใน Pages Artifact เดียวกัน เพื่อเปิดดูคู่กัน (ต้องแก้ Workflow)

---

## ประเด็นที่ต้องตัดสินใจก่อน/ระหว่าง Prompt 3.6

1. **ชื่อแพลตฟอร์ม**: แสดง "Shopee (จำลอง) / Lazada (จำลอง)" ตามข้อกำหนด หรือใช้ชื่อกลาง — แนะนำแบบแรกพร้อมข้อจำกัดความรับผิดชอบ ไม่มีโลโก้
2. **การแสดงคะแนนต่อผู้บริโภค**: แสดงเฉพาะ Band + Coverage + สรุปเหตุผล (แนะนำ) หรือแสดงตัวเลขคะแนนด้วย
3. **ความสัมพันธ์กับ Trust Level เดิม**: ผลประเมินเป็นเกณฑ์เพิ่มของ Level 3–4 (แนะนำ — ไม่เปลี่ยนความหมายของ Level เดิม)
4. **วิธีเผยแพร่ v2**: Merge เข้า `main` หรือแยก `/sme-trust/v2/`
