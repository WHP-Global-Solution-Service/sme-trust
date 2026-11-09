import { Check, KeyRound, Lock, Minus, ShieldCheck } from 'lucide-react';
import { Alert, Badge, Card, CardHeader, PageHeader } from '@/components/common/ui';
import { ROLE_LABEL } from '@/constants/labels';
import { cn } from '@/utils/cn';
import { NOT_IN_SYSTEM, PERMISSION_GROUP_LABEL, ROLES, can, permissionList, type PermissionDef, type PermissionGroup } from '@/auth/permissions';

const GROUPS: PermissionGroup[] = ['public', 'consumer', 'merchant', 'officer', 'admin'];

function Mark({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-success-50 text-success" aria-label={`${label}: มีสิทธิ์`} title="มีสิทธิ์">
      <Check className="h-4 w-4" aria-hidden />
    </span>
  ) : (
    <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-bg text-ink-soft" aria-label={`${label}: ไม่มีสิทธิ์`} title="ไม่มีสิทธิ์">
      <Minus className="h-4 w-4" aria-hidden />
    </span>
  );
}

function Enforcement({ def }: { def: PermissionDef }) {
  const guarded = (def.actions ?? []).filter((a) => a.guarded);
  return (
    <div className="mt-1 space-y-1 text-[11px] leading-relaxed text-ink-soft">
      <p className="break-all font-mono">{def.routes.join(' · ')}</p>
      {guarded.length > 0 && (
        <p className="flex flex-wrap items-center gap-1">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          <span className="break-all font-mono">{guarded.map((a) => a.name).join(' · ')}</span>
        </p>
      )}
      {def.note && <p className="text-ink">{def.note}</p>}
    </div>
  );
}

/** Role & Permission Matrix — อ่านอย่างเดียว · สร้างจาก src/auth/permissions.ts ซึ่งเป็นแหล่งเดียวกับที่ RoleGate และ authorize() ใช้บังคับสิทธิ์ */
export default function PermissionMatrixPage() {
  const rows = permissionList();
  return (
    <div>
      <PageHeader title="Role & Permission Matrix" subtitle="บทบาทใดทำอะไรได้บ้าง — สร้างจากนโยบายสิทธิ์ชุดเดียวกับที่ระบบใช้บังคับจริง" icon={KeyRound} />
      <div className="mb-4 space-y-2">
        <Alert tone="info" icon={ShieldCheck} title="อ่านอย่างเดียว">
          ระบบยังไม่มีการแก้ไขสิทธิ์แบบ Dynamic — ตารางนี้สะท้อนการตรวจสิทธิ์ 2 ชั้น: เส้นทางหน้าจอ (RoleGate) และฟังก์ชันที่เปลี่ยนข้อมูล (authorize — ปฏิเสธและบันทึก Audit Log เมื่อบทบาทไม่มีสิทธิ์)
        </Alert>
        <Alert tone="warning">ระบบต้นแบบไม่มี Backend — การบังคับสิทธิ์ทำในแอปบน Browser ระบบจริงต้องตรวจสิทธิ์ซ้ำที่ API ฝั่งเซิร์ฟเวอร์</Alert>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="สรุปจำนวนสิทธิ์ต่อบทบาท">
        {ROLES.map((r) => (
          <Card key={r} className="p-3" data-role={r}>
            <p className="text-xs text-ink-soft">{ROLE_LABEL[r]}</p>
            <p className="text-xl font-bold text-ink">
              {rows.filter(([k]) => can(r, k)).length}
              <span className="text-sm font-normal text-ink-soft"> / {rows.length} สิทธิ์</span>
            </p>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {GROUPS.map((grp) => {
          const items = rows.filter(([, d]) => d.group === grp);
          return (
            <Card key={grp} data-testid={`perm-group-${grp}`}>
              <CardHeader title={PERMISSION_GROUP_LABEL[grp]} subtitle={`${items.length} รายการ`} />
              {/* จอกว้าง: ตาราง */}
              <div className="hidden lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-soft">
                      <th className="px-4 py-2 font-medium">Module / Action</th>
                      {ROLES.map((r) => (
                        <th key={r} className="w-24 px-2 py-2 text-center font-medium">
                          {ROLE_LABEL[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(([key, def]) => (
                      <tr key={key} className="border-b border-line last:border-0 align-top" data-permission={key}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-ink">{def.label}</p>
                          <p className="font-mono text-[11px] text-secondary">{key}</p>
                          <Enforcement def={def} />
                        </td>
                        {ROLES.map((r) => (
                          <td key={r} className="px-2 py-2.5 text-center" data-role={r} data-allowed={can(r, key)}>
                            <Mark ok={can(r, key)} label={ROLE_LABEL[r]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* จอเล็ก: การ์ดต่อสิทธิ์ */}
              <ul className="divide-y divide-line lg:hidden">
                {items.map(([key, def]) => (
                  <li key={key} className="px-4 py-3">
                    <p className="font-medium text-ink">{def.label}</p>
                    <p className="font-mono text-[11px] text-secondary">{key}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ROLES.map((r) => (
                        <Badge key={r} tone={can(r, key) ? 'success' : 'neutral'} className={cn(!can(r, key) && 'line-through opacity-70')}>
                          {can(r, key) ? '✓' : '✗'} {ROLE_LABEL[r]}
                        </Badge>
                      ))}
                    </div>
                    <Enforcement def={def} />
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}

        <Card>
          <CardHeader title="ยังไม่มีในระบบต้นแบบ" subtitle="แสดงไว้เพื่อไม่ให้เข้าใจผิดว่าผู้ดูแลระบบทำได้" />
          <ul className="space-y-1.5 p-4 text-sm text-ink sm:px-5">
            {NOT_IN_SYSTEM.map((t) => (
              <li key={t} className="flex gap-2">
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
