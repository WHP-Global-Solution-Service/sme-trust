// รัน E2E ภายใต้ base path /sme-trust/ (เหมือน GitHub Pages) — ส่งต่ออาร์กิวเมนต์ให้ Playwright ได้ เช่น --reporter=line
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['playwright', 'test', '--project=chromium', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, E2E_BASE: '/sme-trust/' },
});
process.exit(r.status ?? 1);
