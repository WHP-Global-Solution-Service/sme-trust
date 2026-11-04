# Deployment Readiness — GitHub Pages

สถานะ: **Deploy แล้ว** — https://whp-global-solution-service.github.io/sme-trust/

- Repository: https://github.com/WHP-Global-Solution-Service/sme-trust (branch `main`)
- Deploy อัตโนมัติด้วย GitHub Actions ทุกครั้งที่ Push ไป `main` (รัน `npm test` และ Build ก่อน Deploy)
- ตรวจเว็บจริงด้วยเบราว์เซอร์ (22 ต.ค. 2569): หน้าแรก, ลิงก์ตรง `/verify/...` (ปลายทาง QR), หน้า Demo 8 Scenario, Start Demo, Refresh ระหว่างสาธิต และ AI ตรวจโฆษณา — ทำงานถูกต้อง ไม่มี JavaScript error

## ผลการตรวจ

| รายการ | วิธีตรวจ | ผล |
|---|---|---|
| Build ด้วย base `/sme-trust/` | `npm run test:e2e:subpath` (build + preview จริง) | ✅ Asset ทั้งหมดอยู่ใต้ `/sme-trust/assets/` |
| React Router รองรับ Sub-path | `BrowserRouter basename` = `BASE_URL` (คง `/` ท้าย) + E2E 41 รายการภายใต้ `/sme-trust/` | ✅ |
| Images / Fonts / Assets | ฟอนต์ Noto Sans Thai Bundle ผ่าน Vite, ไม่มี Request ล้มเหลว (E2E ตรวจ Console error ทุกหน้า) | ✅ |
| Direct Route และ Refresh | `postbuild` คัดลอก `index.html` → `404.html` · หน้าแรกเติม `/` ท้าย URL อัตโนมัติ (แก้ UAT-11) · E2E Reload ภายใต้ Sub-path | ✅ (HTTP status 404 ของ Deep link — KI-03) |
| QR Code ใช้ URL ที่รองรับ Sub-path | `appUrl()` = `origin + BASE_URL + path` · E2E ตรวจลิงก์ภายในขึ้นต้นด้วย `/sme-trust/` | ✅ |
| localStorage | ทุก Store persist ปกติภายใต้ Sub-path (E2E Reset/Reload) · ข้อมูลเสียหายใช้ Seed แทน | ✅ |
| ไม่มี API Keys / Secrets | สแกน `src/` และ `.github/` (คำว่า api key, secret, token, bearer) — ไม่พบ · ไม่มี `fetch`/XHR/WebSocket/sendBeacon | ✅ |
| GitHub Actions Workflow | `.github/workflows/deploy-pages.yml`: `npm ci` → `npm test` → `npm run build` (VITE_BASE=/<repo>/) → upload-pages-artifact → deploy-pages · permissions `pages: write`, `id-token: write` (จำเป็นสำหรับ deploy-pages ไม่ใช่ Secret) | ✅ รันบน GitHub สำเร็จ (ครั้งแรกล้มเหลวเพราะยังไม่เปิด Pages → เปิด Settings → Pages → Source: GitHub Actions แล้ว Re-run ผ่าน) |
| `package-lock.json` | มีและรวม `@playwright/test` (devDependency) | ✅ `npm ci` ใช้ได้ |

## ขั้นตอน Deploy (ทำแล้ว — เก็บไว้สำหรับ Repository ใหม่)

1. `git init` → Commit → สร้าง Repository บน GitHub (ชื่อ repo จะเป็น Base path เช่น `sme-trust`)
2. Settings → Pages → Source: **GitHub Actions**
3. Push ไปที่ `main` — Workflow จะทดสอบ Build และ Deploy อัตโนมัติ
4. ก่อน Push แนะนำให้รัน `npm test && npm run test:e2e && npm run test:e2e:subpath && npm run test:e2e:safari` ในเครื่อง (KI-05)

## คำสั่งที่เกี่ยวข้อง

```bash
npm run build                              # base "/"
MSYS_NO_PATHCONV=1 VITE_BASE=/sme-trust/ npm run build   # Git Bash บน Windows
npm run test:e2e:subpath                   # build + E2E ภายใต้ /sme-trust/ (Chromium)
npm run test:e2e:safari                    # E2E บน WebKit (Safari) Desktop + iPhone + iPad
```

---

# SME Trust v2 — เผยแพร่แทน v1 ที่ URL เดิม `/sme-trust/`

สถานะ: **เตรียม Release เสร็จ รอคำสั่งอนุมัติ — ยังไม่ได้ Push / Merge / Deploy** · ไม่ใช่ระบบพร้อมใช้งานจริง (Not Production)

แนวทาง (เปลี่ยนจาก P7-I ที่เตรียมโครงสร้าง `/sme-trust/v2/` + v1 ใน Artifact เดียว):

```
https://<owner>.github.io/sme-trust/   → SME Trust v2 (รวม Scenario 1–13) — Build จาก main หลัง Merge sme-trustv.2
```

- ไม่มี `/sme-trust/v2/` และไม่มี Combined Artifact — ลบ `scripts/pages-combine.mjs`, `build:v2`, `restoreDeepLink` (`__p`) แล้ว
- Workflow เดียว `deploy-pages.yml` Deploy จาก `main` เท่านั้น: TypeScript Check → `npm test` → Build (`VITE_BASE=/<repo>/`) → ตรวจ Build Output → Upload Artifact → Deploy
- Deep link / Refresh: `404.html` = สำเนา `index.html` (เหมือน v1)
- localStorage: v2 ใช้ `smetrust:v2:*` ทุก Base — ข้อมูลเก่าของผู้ที่เคยเปิด v1 (`smetrust:v1:*`) ไม่ถูกโหลดและไม่ถูกลบ
- ตรวจในเครื่อง: `npm run test:e2e:pages` (Build แบบเดียวกับ Workflow → เซิร์ฟเวอร์จำลอง GitHub Pages → E2E 3 เบราว์เซอร์)
- จุดย้อนกลับ: Tag `v1-before-sme-trust-v2` → `4027c04` (สร้างในเครื่อง ยังไม่ Push)

รายละเอียด Preflight, ผลทดสอบ, ขั้นตอนเผยแพร่, การตรวจเว็บจริง และ Rollback Plan: **[release-v2-pages.md](release-v2-pages.md)**
