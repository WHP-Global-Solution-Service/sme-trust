# Release — SME Trust v2 แทน v1 บน GitHub Pages (URL เดิม)

URL: https://whp-global-solution-service.github.io/sme-trust/
Source: `sme-trustv.2` → Merge เข้า `main` → GitHub Actions (`deploy-pages.yml`) Deploy จาก `main` เท่านั้น

> สถานะ: **เตรียม Release เสร็จ — ยังไม่ได้ Push / Merge / Deploy** · รอคำสั่งอนุมัติการเผยแพร่จริง
> Prototype นี้เป็น Frontend Only ด้วยข้อมูลจำลอง — **ไม่ใช่ระบบพร้อมใช้งานจริง (Not Production)**

## 1. ผล Preflight

| # | รายการ | ผล |
|---|---|---|
| 1 | Git Status / Branch | `sme-trustv.2` · Working tree สะอาดก่อนเริ่ม |
| 2 | v2 Commit ล่าสุดก่อน Release | `a0e3f81` (P7) |
| 3 | `main` กับ `sme-trustv.2` | `main` = `4027c04` = `origin/main` (ตรวจด้วย `git fetch` / `ls-remote`) · `main` เป็นบรรพบุรุษของ `sme-trustv.2` (ตามหลัง 0, นำหน้า 7 รวม Release Commit) → **Merge ได้โดยไม่มี Conflict** · `sme-trustv.2` ยังไม่เคย Push |
| 4 | Workflow เดิม | `deploy-pages.yml` ไฟล์เดียว: Push `main` → `npm ci` → `npm test` → `npm run build` (VITE_BASE=/<repo>/) → Deploy · ไม่มี Workflow อื่นที่ Deploy |
| 5 | Vite Base | `VITE_BASE` → `/sme-trust/` (ไม่ใช่ `/sme-trust/v2/`) |
| 6 | Router | `BrowserRouter` + `basename` = `BASE_URL` (ไม่ใช้ HashRouter) |
| 7 | Deep link / 404 | `postbuild` คัดลอก `index.html` → `404.html` (แบบเดียวกับ v1) — ลบกลไก `__p` / `restoreDeepLink` ของโครงสร้าง `/v2/` เดิมออก (ไม่มี Redirect แล้ว) |
| 8 | Static Assets | JS/CSS/ฟอนต์อยู่ใต้ `/sme-trust/assets/` · favicon `/sme-trust/favicon.svg` (Vite เติม Base ให้) |
| 9 | **localStorage** | **พบปัญหาและแก้แล้ว:** เดิม v2 ที่ Base `/sme-trust/` จะใช้ Namespace `smetrust:v1:` เดียวกับ v1 → ผู้ที่เคยเปิด v1 จะได้ข้อมูลรูปแบบเก่า (ไม่มีข้อมูลตัวอย่าง Marketplace/Scenario 9–13) โหลดเข้า v2 · แก้เป็น `smetrust:v2:` ทุก Base · ไม่ลบคีย์ v1 (Rollback แล้วข้อมูลเดิมยังอยู่) |
| 10 | Security / Secrets | ไม่มี Secret ใน `src/` และ Workflow · ไม่มี `fetch`/XHR/WebSocket/sendBeacon · Workflow ใช้เฉพาะ `GITHUB_TOKEN` แบบ OIDC ของ deploy-pages (`pages: write`, `id-token: write`) |

## 2. การเปลี่ยนแปลงใน Release Commit

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `.github/workflows/deploy-pages.yml` | เพิ่ม TypeScript Check, ตรวจ Build Output (`404.html` = `index.html`, Asset ใต้ `/<repo>/`, ไม่มี `/v2/`), `if: github.ref == 'refs/heads/main'` ทั้ง Build และ Deploy (สั่งด้วยมือจาก Branch อื่นจะไม่ Deploy), `cancel-in-progress: false` (ไม่ตัด Deploy ที่กำลังทำ), `timeout-minutes` |
| `src/stores/createEntityStore.ts` | `STORAGE_PREFIX = 'smetrust:v2:'` ทุก Base |
| `src/main.tsx`, `src/utils/appUrl.ts` | ลบ `restoreDeepLink` (ใช้เฉพาะโครงสร้างรวม `/v2/`) |
| `src/routes/lazyPage.tsx` | โหลดไฟล์หน้าแบบลองซ้ำ + ใช้การโหลดร่วมกัน (แก้ Render error บน Firefox) |
| `scripts/run-tests.mjs` | Test runner ข้ามแพลตฟอร์ม — `npm test` เรียกไฟล์นี้ (ชุดและลำดับเดิม) |
| `package.json` | ลบ `build:v2` · `test` → `node scripts/run-tests.mjs` |
| `scripts/pages-combine.mjs` | ลบ (ไม่สร้าง Combined Artifact) |
| `scripts/e2e-pages.mjs`, `playwright.pages.config.ts`, `tests/e2e/pages.spec.ts` | ตรวจเว็บไซต์เดียวที่ `/sme-trust/`: Build แบบเดียวกับ Workflow → เซิร์ฟเวอร์จำลอง GitHub Pages → E2E |
| `tests/**` | คีย์ localStorage ในการทดสอบ `smetrust:v1:` → `smetrust:v2:` (เงื่อนไขเดิม) · แทนการทดสอบ `restoreDeepLink` ด้วยการตรวจ Namespace และการไม่เขียน URL ใหม่ |
| Docs | ไฟล์นี้, `deployment-readiness.md`, `known-issues.md`, `README.md`, `demo-guide.md` |

## 3. ผลการตรวจในเครื่อง

ทดสอบกับ Build ที่ Base `/sme-trust/` (คำสั่งเดียวกับ Workflow) · วันที่ 4 พ.ย. 2569 · **ไม่ใช่ GitHub Pages จริง**

| รายการ | ผล |
|---|---|
| TypeScript (`npm run typecheck`) | ✅ ผ่าน |
| `npm test` (13 ชุด) | ✅ ผ่านทั้งหมด — thai 4 · flows 123 · ai 60 · scenarios 234 · workflows ALL PASS · v2 marketplace 27 · assessment 30 · workflows 41 · ui 18 · scenarios 175 · validation 56 · p7 98 · render 115 เส้นทาง |
| `npm run build` (`VITE_BASE=/sme-trust/`) | ✅ `404.html` = `index.html` · Asset ใต้ `/sme-trust/assets/` · favicon `/sme-trust/favicon.svg` · ไม่มี `/v2/` · ไฟล์หลัก 547.71 kB (gzip 181.23 kB) |
| ขั้นตอน "Verify build output" ของ Workflow (รันด้วย bash กับ Build จริง) | ✅ ผ่าน · กรณี Base ผิด → ล้มเหลวตามที่ควร |
| E2E Chromium ครบทุกชุด @ `/sme-trust/` | ✅ 61/61 |
| E2E Firefox ครบทุกชุด @ `/sme-trust/` | ✅ 61/61 (ครั้งแรกที่รัน Firefox ครบทุกชุด รวม v1) |
| E2E WebKit — v2 ทุกชุด + Full Journey + Scenario 1–8 @ `/sme-trust/` | ✅ 23/23 |
| E2E GitHub Pages จำลอง (`npm run test:e2e:pages`) | ✅ Chromium 3/3 · Firefox 3/3 · WebKit 3/3 (รอบสุดท้าย WebKit "Page crashed" 1 ครั้งที่ Process ของเบราว์เซอร์ → รันซ้ำ 2 รอบบน Build เดียวกันผ่าน 6/6) |
| ครอบคลุม | Registration, Marketplace Connection, Price & Review Analysis, Trust Assessment, Officer Approval, Badge/Certificate Verification (QR), Complaint, AI ตรวจโฆษณา/ร้องเรียน, Scenario 1–13, 9B, Full Journey v1/v2, Deep link + Refresh 13 เส้นทาง, ผู้ใช้ที่มีข้อมูล v1 ค้างในเบราว์เซอร์, ไม่มี Request ไปโดเมนอื่นหรือ `/sme-trust/v2/`, ตรวจ Console/Runtime error ทุก Test |
| Security | ✅ ไม่พบ Secret / `.env` / `fetch`/XHR/WebSocket · URL ภายนอกใน Bundle มีเพียงข้อความเตือนของไลบรารี (zustand, date-fns, React) ไม่มีการเรียกใช้ |

**ปัญหาที่พบและแก้ในรอบนี้**

1. **localStorage ชนกับข้อมูล v1** (Preflight ข้อ 9) — แก้เป็น `smetrust:v2:*` + E2E จำลองผู้ใช้เดิม
2. **`npm test` ค้างบน Windows** — `cmd.exe` ของ npm ไม่เริ่มคำสั่งแรกเมื่อเป็น `&&` 13 คำสั่ง (คำสั่งเดี่ยวทำงานปกติ) → เปลี่ยนเป็น `scripts/run-tests.mjs` (ชุดทดสอบและลำดับเดิม หยุดเมื่อล้มเหลวเหมือนเดิม) — 116 วินาที
3. **Firefox: Render error ของหน้าแบบ Lazy** (`roles.spec` Reset Demo Data) — Firefox ยกเลิก Dynamic import ที่ค้างอยู่เมื่อเปลี่ยน/Reload หน้า → `React.lazy` รายงาน Error · แก้ `src/routes/lazyPage.tsx` ให้ลองโหลดซ้ำ (500ms, 1500ms) และใช้การโหลดร่วมกันระหว่าง preload/Render · ลองครบแล้วยังล้มเหลวจะส่ง Error เดิมให้ ErrorBoundary · Unit test 3 ข้อ + Firefox `roles.spec` ×5 = 15/15 + Firefox ครบทุกชุด 61/61


## 4. จุดย้อนกลับ (Rollback Point)

| รายการ | ค่า |
|---|---|
| v1 Commit | `4027c04934ce22d05b812ae88ee5960ce2b30990` |
| Tag (สร้างในเครื่องแล้ว ยังไม่ Push) | `v1-before-sme-trust-v2` (annotated) → `4027c04` |
| Workflow run ของ v1 ที่ Deploy สำเร็จล่าสุด | ดูใน Actions ก่อน Merge และจดเลข Run ไว้ |

## 5. ขั้นตอนเผยแพร่ (ทำหลังได้รับอนุมัติเท่านั้น)

```bash
# 0) ตรวจสถานะ
git fetch origin
git rev-parse origin/main            # ต้องเป็น 4027c04… — ถ้าไม่ใช่ ให้หยุดและรายงาน
git status                           # ต้องสะอาด

# 1) Push Tag และ Branch ต้นทาง (ไม่ Force)
git push origin v1-before-sme-trust-v2
git push -u origin sme-trustv.2      # Push Branch นี้ไม่ Deploy (Workflow ทำงานเฉพาะ main)

# 2) Merge เข้า main โดยไม่ Rewrite History
git switch main
git merge --ff-only origin/main      # main ในเครื่องตรงกับ Remote
git merge --no-ff sme-trustv.2 -m "Release SME Trust v2 to GitHub Pages (replaces v1 at /sme-trust/)"
#    --no-ff สร้าง Merge Commit เดียว → Rollback ได้ด้วย revert ครั้งเดียว

# 3) ตรวจหลัง Merge (หยุดถ้า Fail)
npm ci && npm run typecheck && npm test
MSYS_NO_PATHCONV=1 npm run test:e2e:pages

# 4) Push main → GitHub Actions Deploy
git push origin main
```

หลัง Push: ดู Actions จนทั้ง `build` และ `deploy` สำเร็จ แล้วตรวจเว็บจริงตามข้อ 6

## 6. ตรวจเว็บไซต์จริงหลัง Deploy

- [ ] `https://whp-global-solution-service.github.io/sme-trust/` เปิด v2 (หน้า Demo มีแท็บ "v2 — Marketplace Intelligence" และ Full Journey v2)
- [ ] Deep link + Refresh: `/sme-trust/verify/SMT-2569-000101`, `/sme-trust/m/marketplace`, `/sme-trust/o/assessments`, `/sme-trust/demo/v2/summary`
- [ ] Full Journey v2 ครบ 13 → หน้าสรุป · Scenario 9B · Scenario 1–8 อย่างน้อย 1 เรื่อง
- [ ] AI ตรวจโฆษณา / ผู้ช่วยร้องเรียน
- [ ] DevTools: ไม่มี Console error (ยกเว้นสถานะ 404 ของคำขอแรกของ Deep link — KI-03), ไม่มี Request ไปโดเมนอื่น, ไม่มี Request ไป `/sme-trust/v2/`
- [ ] เบราว์เซอร์ที่เคยเปิด v1: เปิดได้ปกติ ข้อมูลตัวอย่าง v2 ครบ
- [ ] มือถือจริงอย่างน้อย 1 เครื่อง

## 7. Rollback Plan (ไม่ Force Push / ไม่ Rewrite History)

**ทางเลือก A — เร็วที่สุด (ไม่แก้ Git):** Actions → Workflow run ล่าสุดของ v1 ที่สำเร็จ (Commit `4027c04`) → **Re-run all jobs** — GitHub รันซ้ำด้วย Commit เดิม จึง Deploy v1 กลับ (Re-run ได้ภายใน 30 วันหลังรันครั้งแรก) · การ Push `main` ครั้งถัดไปจะ Deploy v2 อีกครั้ง จึงใช้เป็นการแก้ฉุกเฉินระหว่างเตรียมทางเลือก B

**ทางเลือก B — ถาวร (Revert Commit ใหม่):**

```bash
git switch main && git pull --ff-only
git revert -m 1 <merge-commit> -m "Rollback: restore SME Trust v1 on GitHub Pages"
git diff v1-before-sme-trust-v2 HEAD --stat   # ต้องว่าง = ต้นไม้ไฟล์เท่ากับ v1
git push origin main                          # Workflow (ของ v1) Deploy v1
```

ถ้า Merge แบบ Fast-forward (ไม่มี Merge Commit): `git revert --no-commit 4027c04..HEAD && git commit -m "Rollback: restore SME Trust v1"`

หลัง Rollback: ข้อมูลสาธิตของผู้ใช้ v1 (`smetrust:v1:*`) ยังอยู่ เพราะ v2 ไม่ลบ · ข้อมูลของ v2 (`smetrust:v2:*`) ค้างในเบราว์เซอร์โดยไม่มีผล · การนำ v2 กลับมาภายหลัง: `git revert <revert-commit>`

## 8. เกณฑ์ยอมรับ (Release Acceptance)

| เกณฑ์ | ตรวจในเครื่อง | ตรวจบนเว็บจริง |
|---|---|---|
| URL เดิมเปิด v2 / v1 ถูกแทนที่ | ✅ (เซิร์ฟเวอร์จำลอง) | รอ Deploy |
| Scenario 1–13, Full Journey v1/v2, 9B | ✅ | รอ Deploy |
| Marketplace เป็นข้อมูลจำลอง / ไม่มี External API | ✅ (ตรวจ Request ทุกหน้า) | รอ Deploy |
| Trust Model v2.1 | ✅ | รอ Deploy |
| ไม่มีข้อมูลส่วนบุคคลจริง | ✅ (Mock Data) | — |
| ไม่มี Console Errors / Broken Routes | ✅ | รอ Deploy |
| Automated Tests | ✅ | GitHub Actions — รอ Deploy |
| GitHub Actions สำเร็จ | ยังไม่ได้รัน (KI-V2-12) | รอ Deploy |
| Rollback Plan / Git History v1 | ✅ Tag + แผนข้อ 7 · ไม่มีการ Rewrite | — |
