# Deployment Readiness — GitHub Pages

สถานะ: **พร้อม Deploy** (ตรวจในเครื่องแล้ว — ยังไม่ได้ Push หรือ Deploy จริง)

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
| GitHub Actions Workflow | `.github/workflows/deploy-pages.yml`: `npm ci` → `npm test` → `npm run build` (VITE_BASE=/<repo>/) → upload-pages-artifact → deploy-pages · permissions `pages: write`, `id-token: write` (จำเป็นสำหรับ deploy-pages ไม่ใช่ Secret) | ✅ ตรวจโครงสร้างแล้ว (ยังไม่ได้รันบน GitHub) |
| `package-lock.json` | มีและรวม `@playwright/test` (devDependency) | ✅ `npm ci` ใช้ได้ |

## ขั้นตอน Deploy (เมื่อได้รับอนุมัติ)

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
