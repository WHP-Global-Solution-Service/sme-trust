// รัน Automated tests ทั้งหมดตามลำดับ (แทนการต่อคำสั่งด้วย && ใน package.json)
// เรียก tsx ผ่าน Node โดยตรง ไม่ผ่าน Shell — ทำงานเหมือนกันบน Windows และ Linux (GitHub Actions)
// หยุดทันทีเมื่อชุดใดล้มเหลว (exit code ไม่ใช่ 0) เหมือน && เดิม
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const SUITES = [
  'tests/thai.test.mts',
  'tests/flows.test.mts',
  'tests/ai.test.mts',
  'tests/scenarios.test.mts',
  'tests/workflows.test.mts',
  'tests/v2/marketplace.test.mts',
  'tests/v2/assessment.test.mts',
  'tests/v2/workflows.test.mts',
  'tests/v2/ui.test.mts',
  'tests/v2/scenarios.test.mts',
  'tests/v2/validation.test.mts',
  'tests/v2/p7.test.mts',
  'tests/v2/autofill.test.mts',
  'tests/v2/profile-change.test.mts',
  'tests/v2/automation.test.mts',
  'tests/v2/release-automation.test.mts',
  'tests/v2/onboarding.test.mts',
  'tests/v2/permissions.test.mts',
  'tests/v2/demo-center.test.mts',
  'tests/v2/registration-automation.test.mts',
  'tests/render.test.mts',
];

const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
const started = Date.now();
for (const suite of SUITES) {
  console.log(`\n▶ ${suite}`);
  const r = spawnSync(process.execPath, [tsxCli, suite], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n✗ ล้มเหลว: ${suite} (exit ${r.status ?? r.signal})`);
    process.exit(r.status || 1);
  }
}
console.log(`\n✓ ผ่านทั้งหมด ${SUITES.length} ชุด (${Math.round((Date.now() - started) / 1000)} วินาที)`);
