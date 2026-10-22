# Design System — OCPB Inspired

ได้รับแรงบันดาลใจจากโทนสีของ สคบ. **ไม่ใช่ Design System ทางการ** ไม่ใช้โลโก้หรือตราหน่วยงาน และไม่คัดลอก UI/Branding ของแอปเป๋าตัง (ใช้เพียงแนวคิด UX: ขั้นตอนสั้น ปุ่มใหญ่ PIN Keypad)

## สี (`tailwind.config.js`)

| Token | Hex | ใช้กับ |
|---|---|---|
| `primary` | #173F94 | ปุ่มหลัก ลิงก์ Header แถบ Welcome, สีกราฟขนาด |
| `primary-dark` | #112E70 | Hover, QR |
| `secondary` | #C92131 | แถบ Prototype, ปุ่ม Demo Mode, ป้าย "ตัวอย่างใบรับรอง", จุดแจ้งเตือน |
| `bg` | #F4F7FC | พื้นหลังหน้า |
| `surface` | #FFFFFF | การ์ด |
| `ink` / `ink-soft` | #152B49 / #536984 | ข้อความหลัก/รอง |
| `line` | #DCE3EE | เส้นขอบ |
| `success` / `warning` / `error` / `info` | #137552 / #975807 / #B51F31 / #2563EB | สถานะ (มีป้ายข้อความกำกับเสมอ ไม่ใช้สีอย่างเดียว) — ทุกสีผ่าน WCAG AA (≥ 4.5:1) ทั้งบนพื้นขาว พื้น `bg` และพื้นอ่อน `*-50` (ปรับใน UAT รอบ Prompt 4) |

## ตัวอักษร

Noto Sans Thai (400/500/600/700) Bundle ผ่าน `@fontsource/noto-sans-thai` — ไม่โหลดจากภายนอก

## รูปแบบ

- การ์ดมุมโค้ง 14px (`rounded-card`), ปุ่ม/ช่องกรอก 12px, เงาบางเบา (`shadow-card`)
- ปุ่มสูง 44–48px รองรับการแตะ; PIN Keypad ปุ่มสูง 64px
- Mobile-first: < 1024px ใช้ Bottom Navigation (4 เมนูหลัก + "เมนูทั้งหมด"), ≥ 1024px ใช้ Sidebar + Topbar
- ตารางข้อมูล (`DataTable`) แสดงเป็นการ์ดบนมือถือเพื่อเลี่ยง Horizontal overflow
- แถบ "ระบบสาธิต (Prototype)" สีแดงติดด้านบนทุกหน้า

## Components หลัก

| Component | ไฟล์ | หมายเหตุ |
|---|---|---|
| Button / LinkButton | `components/common/ui.tsx` | variant: primary, secondary, outline, ghost, danger, success |
| Card / CardHeader / Alert / Badge / StatusBadge | `ui.tsx` | StatusBadge รับ map ป้ายจาก `constants/labels.ts` |
| EmptyState / Skeleton / SkeletonList | `ui.tsx` | ใช้กับ Empty/Loading state |
| Tabs / Stat / InfoRow / ListLink / PageHeader | `ui.tsx` | |
| DataTable | `common/DataTable.tsx` | Sort, Pagination, Mobile cards |
| Modal | `common/Modal.tsx` | Bottom sheet บนมือถือ |
| Stepper | `common/Stepper.tsx` | Progress Indicator ของ Wizard |
| Timeline | `common/Timeline.tsx` | สีจุดตามผู้กระทำ |
| CertificateCard / TrustSeal / VerdictPanel / VerdictBadge | `common/Trust.tsx` | มีป้าย "ตัวอย่างใบรับรองสำหรับสาธิต" เสมอ; ใบที่ใช้ไม่ได้มีตราประทับทับและ QR จาง |
| HBarChart / TimeBarChart / ChartTable | `common/Charts.tsx` | สีเดียวสำหรับขนาด; สีสถานะเฉพาะข้อมูลสถานะ; มีตารางแทนกราฟ |
| PinPad / PinDots / OtpInput | `forms/PinPad.tsx` | รองรับคีย์บอร์ด |
| MockUpload / DocList | `forms/MockUpload.tsx` | เก็บเฉพาะชื่อไฟล์ |
| Toast / ConfirmDialog | `feedback/Feedback.tsx`, `stores/ui.ts` | `confirmDialog({ reasonLabel })` บังคับกรอกเหตุผล |
| AiSimulationBadge / AiDisclaimer / AiHeader / AiServiceCard | `features/ai-assistant/components/AiCommon.tsx` | ป้าย "AI Simulation — ไม่ใช่ AI Model จริง" บังคับในทุกหน้า AI |
| RiskLevelCard / HighlightedText / FindingList / SuggestedRevision / AdComparison | `ai-assistant/components/AdResult.tsx` | Highlight: แดง = ควรตรวจละเอียด, ส้ม = ควรตรวจเพิ่ม, เทา = ข้อสังเกต (มีคำอธิบายสี ไม่ใช้สีอย่างเดียว) |
| ComplaintResult / ResponseDraftEditor | `ai-assistant/components/` | ระดับการติดตาม Normal/Attention/Urgent ใช้ Tone neutral/warning/error |
| DemoController / RoleTransition | `components/layout/DemoController.tsx` | Desktop: แผงขวา 360px (เนื้อหาเว้น `lg:mr-[360px]`) · Mobile: แถบล่าง + Sheet · ปุ่มถัดไปปิดพร้อมเหตุผลเมื่อยังไม่ผ่าน Gate |

## กราฟ

- ใช้แท่งแนวนอนสำหรับหมวดหมู่ภาษาไทยที่ชื่อยาว, แท่งแนวตั้งสำหรับรายเดือน
- ไม่ใช้กราฟวงกลมหรือแกน Y สองแกน
- ทุกกราฟมี Tooltip, ป้ายค่าบนแท่ง และ "ดูเป็นตาราง"
