# Architecture

## ภาพรวม

```
Browser only
┌──────────────────────────────────────────────────────────────┐
│ React Router (BrowserRouter basename = BASE_URL เช่น /x/)    │
│   ├─ Standalone: / , /register, /login  (AuthFrame)          │
│   └─ AppShell (Sidebar/Topbar/BottomNav + DemoPanel          │
│                + DemoController)                             │
│        └─ RoleGate(allow) → Feature pages                    │
│                                                              │
│ Feature pages ──read──▶ Zustand domain stores (selectors)    │
│               ──write─▶ stores/workflows.ts (cross-domain)   │
│                                                              │
│ AI Simulation: features/ai-assistant/services (Pure, Rules)  │
│ Demo: demo/controller.ts ──▶ useDemoStore (แยกจาก Business)  │
│                                                              │
│ Zustand persist ──▶ localStorage  key: smetrust:v1:<domain>  │
└──────────────────────────────────────────────────────────────┘
ไม่มี Backend / API / Database / External service / AI API
```

## Stores (แหล่งข้อมูลเดียวของทุกหน้าจอ)

สร้างด้วย `createEntityStore<T>(name, seed)` (`stores/createEntityStore.ts`) ทุก Store มี `items`, `add`, `update`, `remove`, `reset` และ persist ลง localStorage

| Store | ข้อมูล | Storage key |
|---|---|---|
| `useOperatorStore` | ผู้ประกอบการ (บุคคล) | `smetrust:v1:operators` |
| `useMerchantStore` | ร้านค้า + ช่องทางขาย + เอกสาร | `…merchants` |
| `useVerificationStore` | คำขอลงทะเบียน/รับรอง | `…applications` |
| `useCertificationStore` | ใบรับรอง | `…certifications` |
| `useComplaintStore` | ข้อร้องเรียน + ข้อความ + ข้อเสนอ + Timeline + ผลคัดกรอง | `…complaints` |
| `useWarningStore` | คำแนะนำ/คำเตือน/การแก้ไข | `…warnings` |
| `useRiskStore` | เรื่องพิจารณาความเสี่ยง/อุทธรณ์ | `…risk` |
| `useTrainingStore` | การลงทะเบียนเรียน/ผลสอบ | `…enrollments` |
| `useNotificationStore` | การแจ้งเตือนทุกบทบาท | `…notifications` |
| `useAuditStore` | Mock Audit Log | `…audit` |
| `useAiHistoryStore` | ประวัติการใช้ AI Simulation (ล่าสุด 20, ไม่เก็บข้อความที่พิมพ์เอง) | `…ai-history` |
| `useAiWorkspaceStore` | ข้อความ/ผลบนหน้า AI และร่างคำตอบที่รอใส่เคส | `…ai-workspace` |
| `useDemoStore` | Scenario State: เรื่อง ขั้น สถานะ Context IDs ผลแต่ละเรื่อง สัญญาณ UI | `…demo` (+ `…demo-snapshot`) |
| `useSessionStore` | บทบาท บัญชีที่ใช้ ฉบับร่างร้านค้า | `…session` |
| `useUiStore` | Toast, Confirm Dialog (ไม่ persist) | — |

ข้อมูลคงที่ (ไม่เปลี่ยนระหว่างสาธิต): ผู้บริโภค เจ้าหน้าที่ หลักสูตร — อยู่ใน `mock/data`

## Workflows (`stores/workflows.ts`)

ทุก Action ที่กระทบหลาย Domain ผ่านฟังก์ชันในไฟล์นี้เท่านั้น เพื่อให้ผลสอดคล้องกันทุกมุมมอง เช่น

- `approveApplication` → อัปเดตคำขอ + สถานะร้าน + ออกใบรับรอง (แทนที่ใบเดิม) + แจ้งเตือนร้านค้า + Audit
- `submitComplaint` → คัดกรอง (Rule-based) + สร้าง Case ID + Timeline + แจ้งร้านค้า/ผู้บริโภค/เจ้าหน้าที่ (ถ้าเร่งด่วน)
- `riskAction` / `reviewAppeal` → สถานะเรื่อง + สถานะใบรับรอง + สถานะความเสี่ยงของร้าน (`recomputeRisk`)
- `submitQuiz` → ผลสอบ + เลขใบรับรองการอบรม + ติ๊กรายการแก้ไขในคำเตือนที่แนบหลักสูตร
- `recordAiAnalysis` / `clearAiHistory` → ประวัติ AI (จำกัด 20 รายการ)
- `resetAllDemoData` → reset ทุก Domain Store เป็น seed + ล้าง AI Workspace และ Demo State

ทุก Workflow บันทึก Timeline ด้วยชื่อผู้กระทำจาก `currentActor()` (บทบาทปัจจุบันใน Session) และเพิ่ม Audit Log

## ข้อมูลที่คำนวณ (Derived)

ไม่เก็บซ้ำ คำนวณจาก State ทุกครั้ง:

- `utils/trust.ts` — `currentCert`, `verdictFor` (ผลตรวจสอบสาธารณะ), `effectiveLevel`
- `utils/criteria.ts` — เกณฑ์ Level 1–4
- `utils/stats.ts` — KPI และข้อมูลกราฟทั้งหมดของ Admin Dashboard
- `utils/screening.ts` — Complaint Screening Assistant
- `features/ai-assistant/services/*` — AI-01/AI-02 (ดู `ai-simulation.md`)

## Routing & สิทธิ์

`routes/AppRoutes.tsx` ห่อแต่ละหน้าด้วย `RoleGate` (`components/layout/AppShell.tsx`):

- บทบาทไม่ตรง → การ์ด Permission Denied + ปุ่มสลับบทบาท
- บทบาท merchant แต่ยังไม่เลือกบัญชี → `/`; ยังไม่เข้าสู่ระบบ → `/login`
- ภายในหน้ารายละเอียดมีการตรวจความเป็นเจ้าของ (เช่น ผู้บริโภคเปิดเรื่องของคนอื่นไม่ได้)

QR Code และลิงก์ร้านสร้างด้วย `appUrl()` (`utils/appUrl.ts`) = `origin + BASE_URL + path` จึงถูกต้องทั้งที่ `/` และ Sub-path ของ GitHub Pages · `vite.config.ts` อ่าน `VITE_BASE` · `postbuild` คัดลอก `index.html` เป็น `404.html` สำหรับลิงก์ตรงบน GitHub Pages (Static hosting อื่นต้องตั้ง rewrite ไป `index.html`)

## Demo Presentation Mode

ดู [demo-scenario-architecture.md](demo-scenario-architecture.md) — Scenario เป็นข้อมูล (`mock/scenarios`), Logic อยู่ใน `demo/controller.ts`, UI อยู่ใน `DemoController.tsx` · ปุ่มถัดไปตรวจ Gate จาก Business State หรือสัญญาณ UI (`reportDemo`) และไม่เปลี่ยนข้อมูลธุรกิจแทนผู้ใช้

## การทดสอบ

- `tests/flows.test.mts` — 10 Flow ข้ามบทบาท + Integrity + Persistence (123)
- `tests/ai.test.mts` — AI Simulation Service (51)
- `tests/scenarios.test.mts` — Demo Controller: 8 Scenario + Full Journey + Restart/Refresh (212)
- `tests/workflows.test.mts` — รัน Workflow จริงกับ Store จริงใน Node (localStorage shim) ตรวจ 60+ เงื่อนไขข้ามบทบาท
- `tests/render.test.mts` — Server-render 78 เส้นทาง/บทบาท ตรวจว่าไม่มี Error และ Role Gate ถูกต้อง
