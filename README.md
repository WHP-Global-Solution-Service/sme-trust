# SME Trust Platform — ระบบสาธิต (Interactive Prototype)

แพลตฟอร์มสาธิตสำหรับลงทะเบียน คัดกรอง รับรองความน่าเชื่อถือของผู้ประกอบการ SME และป้องกันปัญหาการซื้อขายออนไลน์
ได้รับแรงบันดาลใจจากแนวคิดความร่วมมือระหว่างสภา SME และสำนักงานคณะกรรมการคุ้มครองผู้บริโภค (สคบ.)

> **ระบบสาธิต (Prototype)** — Frontend-only ไม่มี Backend ไม่เชื่อมต่อระบบภายนอก ข้อมูลทั้งหมดเป็นข้อมูลสมมติและเก็บใน `localStorage` ของเบราว์เซอร์เท่านั้น
> ไม่ใช่ระบบยืนยันตัวตน การรับรอง หรือ Blacklist ของหน่วยงานรัฐที่ใช้งานจริง และไม่ได้รับการรับรองจากหน่วยงานใด

## เริ่มต้นใช้งาน

ต้องการ Node.js 18 ขึ้นไป (ทดสอบกับ Node 20.19)

```bash
npm install
npm run dev        # เปิด http://localhost:5173
npm run build      # Type-check (tsc -b) + Production build ไปที่ dist/
npm run preview    # เปิดดู build
npm test           # พิสูจน์อักษรไทย, Flow ข้ามบทบาท, AI Simulation, Demo Scenarios 1–13 + Full Journey v1/v2, Workflow, Model Validation, P7 Regression และ Render ทุกหน้า
npm run typecheck  # TypeScript (strict)
npm run test:e2e   # E2E บน Chromium จริง (build + preview อัตโนมัติ) — ครั้งแรกอาจต้อง npx playwright install chromium
npm run test:e2e:subpath  # E2E ภายใต้ /sme-trust/ (เหมือน GitHub Pages)
npm run test:e2e:safari   # E2E บน WebKit (Engine ของ Safari): Desktop + iPhone + iPad — ครั้งแรกต้อง npx playwright install webkit
npm run test:e2e:firefox  # E2E บน Firefox — ครั้งแรกต้อง npx playwright install firefox
npm run test:e2e:pages    # Build แบบเดียวกับ Workflow (/sme-trust/) + จำลอง GitHub Pages (404.html) + E2E (ไม่ Deploy)
```

เริ่มนำเสนอ: เปิด **`/demo`** (หน้ารวม Demo Scenarios — ปุ่มบนหน้าแรก) → **Start Full Journey** (เรื่องต่อเนื่อง 1 → 8) หรือ **Start Demo** รายเรื่อง แล้วใช้ **Demo Controller** (แผงขวาบนเดสก์ท็อป / แถบล่างบนมือถือ) ไปทีละขั้น · ปุ่มถัดไปเปิดเมื่อทำขั้นนั้นเสร็จจริง · **Restart Scenario** เริ่มเรื่องเดิมใหม่ได้ทุกเมื่อ
จำลองหน้าจอโทรศัพท์ / iPad / โน้ตบุ๊ก: ปุ่ม **จำลองหน้าจอ** บน Topbar หรือ Demo Mode → มุมมองหน้าจอ
บัญชีผู้ประกอบการตัวอย่างใช้ PIN `123456`

## Deploy บน GitHub Pages

มี Workflow ที่ `.github/workflows/deploy-pages.yml` (Push ที่ `main` → TypeScript Check → Tests → Build → Deploy) — v2 เผยแพร่แทน v1 ที่ URL เดิม `/sme-trust/` เมื่อ Merge เข้า `main` (ขั้นตอนและ Rollback: [docs/release-v2-pages.md](docs/release-v2-pages.md)) ตั้งค่า Repository: **Settings → Pages → Source: GitHub Actions**

- Build ด้วย `VITE_BASE=/<ชื่อ repo>/` — Router, ลิงก์ QR/ใบรับรอง และ Device Preview ใช้ Base Path นี้อัตโนมัติ
- `postbuild` คัดลอก `index.html` เป็น `404.html` เพื่อให้ลิงก์ตรง (เช่น `/verify/...`) เปิดได้บน GitHub Pages
- Build เองในเครื่อง: `VITE_BASE=/sme-trust/ npm run build` (Git Bash บน Windows ให้เติม `MSYS_NO_PATHCONV=1` นำหน้า)

## สิ่งที่สาธิตได้

| บทบาท | ฟังก์ชันหลัก |
|---|---|
| ผู้ประกอบการ | ลงทะเบียน (OTP/e-KYC/PIN จำลอง), PIN Login + Biometric จำลอง, ลงทะเบียนร้านค้า 7 ขั้นตอน (บันทึก/กลับมาทำต่อ), ขอรับรอง/ต่ออายุ, SME Trust Passport, ตอบข้อร้องเรียน, รับคำเตือนและส่งหลักฐานแก้ไข, อบรม+แบบทดสอบ, อุทธรณ์, Marketing Toolkit (Badge/QR) |
| ผู้บริโภค | ค้นหา/ทำเนียบร้านค้า (ไม่ต้องเข้าสู่ระบบ), สแกน QR จำลอง, ตรวจใบรับรอง, แจ้งปัญหา 7 ขั้นตอน, ตอบข้อเสนอ/ยืนยันผล/ขอส่งต่อ |
| เจ้าหน้าที่ | Dashboard + Work Queue, ตรวจและอนุมัติคำขอ, ตรวจช่องทางขาย, จัดการใบรับรอง, จัดการข้อร้องเรียน (ปรับผล Screening), ออกคำแนะนำ/คำเตือน, ตรวจผลแก้ไข, Risk Review + อุทธรณ์, Training Records, Reports (CSV) |
| AI Simulation (ผู้ประกอบการ) | AI-01 ตรวจสอบข้อความโฆษณา (Highlight, ระดับความเสี่ยงเบื้องต้น, ข้อความเสนอแก้ไข, เปรียบเทียบก่อน–หลัง), AI-02 ช่วยจัดการข้อร้องเรียน (สรุปประเด็น, ข้อมูลที่ควรขอ, ร่างคำตอบ 3 Tone นำไปใส่เคสโดยไม่ส่งอัตโนมัติ), ประวัติการใช้งาน — **Rule-based ในเบราว์เซอร์ ไม่ใช่ AI Model จริง** |
| ผู้ดูแลระบบ | Admin Dashboard (12 KPI + 7 กราฟ คำนวณจาก Mock State), บัญชีทั้งหมด, Audit Log, Export/Reset ข้อมูลสาธิต |

## SME Trust v2

ต่อยอดจาก v1 โดยไม่ลบฟังก์ชันเดิม — รายละเอียดใน [docs/sme-trust-v2-plan.md](docs/sme-trust-v2-plan.md) · บันทึกการเผยแพร่ใน [docs/release-v2-pages.md](docs/release-v2-pages.md)

**เผยแพร่แล้ว** ที่ https://whp-global-solution-service.github.io/sme-trust/ (ล่าสุด Merge `304d247`, GitHub Actions Run #5):

- เชื่อมต่อ **Shopee (จำลอง) / Lazada (จำลอง)** — ยังไม่มีการเชื่อมต่อ API จริง ข้อมูลการขายสร้างแบบ Deterministic ในเบราว์เซอร์
- วิเคราะห์ราคา ยอดขาย รีวิว → **Trust Assessment** (Band A–D / Insufficient Data, Data Coverage, Data Confidence, คำอธิบายทุกปัจจัย)
- ผู้บริโภคไม่เห็นคะแนนตัวเลข · Standing (ระงับ/เพิกถอน) แยกจาก Band · ยกระดับ Level 3–4 ผ่าน Officer Review และเกณฑ์ v1 เท่านั้น
- **ลงทะเบียนด้วยข้อมูลจาก Marketplace (จำลอง)** — เลือก Shopee/Lazada (จำลอง) → อนุญาต (จำลอง) → เลือกร้าน → Preview → เติมแบบฟอร์มอัตโนมัติ พร้อมป้ายที่มาของข้อมูล ฉบับร่างอัตโนมัติ และตารางเทียบต้นฉบับกับข้อมูลที่แก้ให้เจ้าหน้าที่ (Scenario 9 สำหรับร้านเดิม, 9A สำหรับร้านใหม่)
- **Demo v2** — Scenario 9–13 (เชื่อมข้อมูล → วิเคราะห์ → ประเมิน → เจ้าหน้าที่พิจารณา → ผู้บริโภคตรวจสอบ), เส้นทางทางเลือก 9A (ร้านใหม่ Auto-Fill) และ 9B (ร้านที่ไม่มี Marketplace), Full Journey v2 แยกจาก v1 และ Executive Impact Summary (`/demo/v2/summary`)
- **หน้าแรก Concept v2** — แพลตฟอร์มกลางประเมินความน่าเชื่อถือ (ไม่ใช่ Marketplace ไม่ขายสินค้า ไม่รับชำระเงิน) · CTA เชื่อมร้านค้าออนไลน์ / ลงทะเบียนด้วยตนเอง / เข้าสู่ระบบ / ตรวจสอบร้านค้า · Trust Assessment 7 ปัจจัย · Trust Badge · Demo 15 เส้นทาง
- **คำขอเปลี่ยนข้อมูลร้าน** — ชื่อร้าน/หมวดของร้านที่ได้รับการรับรองต้องให้เจ้าหน้าที่อนุมัติ (อนุมัติ / ไม่อนุมัติ / ขอข้อมูลเพิ่ม) พร้อมประวัติ การแจ้งเตือน และ Audit Log · ข้อมูลต้นฉบับ Marketplace และระดับใบรับรองไม่เปลี่ยน

**อยู่ใน Branch `sme-trustv.2` — ยังไม่เผยแพร่: Automation First, Human by Exception** ([docs/automation-first-workflow.md](docs/automation-first-workflow.md))

- ระบบประเมินอัตโนมัติเมื่อร้านนำเข้า/ซิงก์ข้อมูล แล้วจัดเส้นทางด้วย **Decision Router**: AUTO_PASS / AUTO_REQUEST_INFO / MANUAL_REVIEW
- **Trust Assessment Badge** ออกและอัปเดตอัตโนมัติ (แยกจากใบรับรอง — Level 2–4 ยังต้องให้เจ้าหน้าที่อนุมัติ)
- **Exception Queue** สำหรับเจ้าหน้าที่ (`/o/exceptions`) — หนึ่งงานต่อประเด็น พร้อม Evidence Snapshot เหตุผล และ Approve / Reject / Request Info · KPI จาก Mock State (`/o/automation`)
- ชื่อร้าน/หมวดที่ตรงกับต้นฉบับ Marketplace ตรวจสอบอัตโนมัติ · ค่าอื่นใช้ Workflow อนุมัติเดิม
- Demo: Scenario 14 (เส้นทางปกติ ไม่มีเจ้าหน้าที่) · Scenario 15 (กรณียกเว้น) · ชื่อใน UI รวมเป็นระบบเดียว

**อยู่ใน Branch `sme-trustv.2` — ยังไม่เผยแพร่: Unified Platform Enhancement** ([docs/unified-merchant-onboarding.md](docs/unified-merchant-onboarding.md))

- ลงทะเบียน 2 ช่องทาง (Marketplace / สมัครเอง) ภายใต้ Merchant, Application, Assessment และ Badge กลาง
- KYC & Business Verification แบบจำลอง: บุคคลธรรมดา / นิติบุคคล (Mock DBD) · เอกสารตามกฎ (Dynamic) · Verification Summary ทั้งมุมร้านค้าและเจ้าหน้าที่
- หลายแพลตฟอร์มต่อร้าน · เพิ่ม Marketplace ภายหลังโดยไม่สร้างร้านใหม่ · กัน Shop ID ซ้ำ และส่งเจ้าหน้าที่เมื่อความเป็นเจ้าของขัดแย้ง
- Assessment Badge แสดงชื่อร้าน แหล่งข้อมูล ลิงก์ตรวจสอบ และ Mock QR
- หน้าแรก Executive Ready · Demo ตาม User Journey · [Executive Demo Guide](docs/executive-demo-guide.md) · [Consistency Audit](docs/cross-system-consistency-audit.md)

## เทคโนโลยี

React 18 + TypeScript, Vite 5, Tailwind CSS 3, React Router 6, Zustand 4 (persist → localStorage), React Hook Form + Zod, Lucide React, Recharts, date-fns

ไลบรารีเพิ่มเติมที่เลือกใช้ (และเหตุผล):

- `qrcode.react` — สร้าง QR Code ฝั่ง Client ไม่ต้องเรียกบริการภายนอก
- `@fontsource/noto-sans-thai` — Bundle ฟอนต์ Noto Sans Thai มากับแอป แทนการโหลดจาก Google Fonts (ไม่มีการเชื่อมต่อภายนอก)
- `clsx` — รวม className แบบมีเงื่อนไข (ขนาดเล็กมาก)
- `tsx` (dev) — รันชุดทดสอบ TypeScript ใน Node โดยไม่ต้องติดตั้ง Test Framework ขนาดใหญ่

ไม่ได้ติดตั้ง ESLint/Prettier เพื่อลดขนาดโปรเจกต์ ใช้ `tsc` แบบ `strict` + `noUnusedLocals` ในการตรวจโค้ด

## โครงสร้างโปรเจกต์

```
src/
  app/            App + Router
  routes/         AppRoutes (ทุกเส้นทาง + Role Gate), nav.ts (เมนูแต่ละบทบาท)
  components/
    common/       ui (Button, Card, Badge, Alert, Stat...), DataTable, Modal, Stepper, Timeline, Trust (Certificate/Badge/QR), Charts
    forms/        Field/Input/Select, PinPad/OtpInput, MockUpload
    feedback/     Toast, Confirm Dialog, Prototype Banner
    layout/       AppShell (Sidebar/Topbar/Bottom Nav), DemoPanel, DemoController
  features/       หน้าจอแยกตามโมดูล (onboarding, auth, merchants, verification, certification, passport,
                  consumers, complaints, resolution, warnings, training, risk, officer, admin, demo)
    ai-assistant/ AI Simulation — rules/ services/ (Pure Function) แยกจาก components/ pages/
  demo/           Demo Controller (types, controller.ts)
  stores/         Zustand stores แยก Domain + workflows.ts (Action ข้าม Domain)
  mock/data/      ข้อมูลจำลองที่เชื่อมโยงกันผ่าน ID
  mock/scenarios/ Demo Scenario 1–8 + Fixtures + บัญชีสาธิต
  types/          TypeScript models
  utils/          trust (ผลตรวจสอบ), screening (Rule-based), criteria, stats (KPI), format, id
  hooks/          useCurrent*, useStats
  constants/      ป้ายกำกับสถานะภาษาไทย
tests/            flows, ai, scenarios, workflows, render (*.test.mts) · e2e/ (Playwright *.spec.ts)
docs/             เอกสารประกอบ
```

## เอกสาร

- [docs/requirements.md](docs/requirements.md) — ขอบเขตและการแมปข้อกำหนด
- [docs/architecture.md](docs/architecture.md) — สถาปัตยกรรมและ State
- [docs/design-system.md](docs/design-system.md) — สี ตัวอักษร Component
- [docs/user-flows.md](docs/user-flows.md) — ลำดับการใช้งานและสถานะ
- [docs/demo-guide.md](docs/demo-guide.md) — ขั้นตอนสาธิตแต่ละ Scenario
- [docs/demo-scenario-architecture.md](docs/demo-scenario-architecture.md) — Demo Controller, Gate, Full Journey, Restart
- [docs/ai-simulation.md](docs/ai-simulation.md) — กฎและการทำงานของ AI-01 / AI-02
- [docs/mock-data.md](docs/mock-data.md) — ข้อมูลจำลองและความเชื่อมโยง
- [docs/test-checklist.md](docs/test-checklist.md) — รายการทดสอบและผล
- [docs/limitations.md](docs/limitations.md) — ข้อจำกัดและสิ่งที่ระบบนี้ไม่ใช่
- [docs/uat-report.md](docs/uat-report.md) — ผล UAT ล่าสุด (Test case / Expected / Actual / Severity / Fix / Retest)
- [docs/known-issues.md](docs/known-issues.md) — ข้อจำกัดที่ยังเหลือ
- [docs/deployment-readiness.md](docs/deployment-readiness.md) — ความพร้อม GitHub Pages

## แหล่งอ้างอิงแนวคิด

- ข่าว: https://spacebar.th/business/sme-council-consumer-protection-board-sign-mou-upgrade-online-stores
- สคบ.: https://www.ocpb.go.th/

ใช้ข่าวเป็นข้อมูลประกอบแนวคิดเท่านั้น ไม่ถือเป็นข้อกำหนดทางกฎหมายหรือการอนุมัติระบบอย่างเป็นทางการ
