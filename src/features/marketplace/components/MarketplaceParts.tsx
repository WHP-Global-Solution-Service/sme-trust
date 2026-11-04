import { useState } from 'react';
import { CheckCircle2, FlaskConical, PlugZap, Unplug } from 'lucide-react';
import type { Archetype, ConnectionStatus, Platform } from '../types';
import { ARCHETYPE_LABEL, CONSENT_SCOPES, MARKETPLACE_DISCLAIMER, PLATFORMS } from '../data/platforms';
import type { Tone } from '@/constants/labels';
import { Modal } from '@/components/common/Modal';
import { Alert, Button } from '@/components/common/ui';

export const CONNECTION_STATUS: Record<ConnectionStatus, { label: string; tone: Tone }> = {
  pending_consent: { label: 'รอความยินยอม', tone: 'neutral' },
  syncing: { label: 'กำลังซิงก์ข้อมูล (จำลอง)', tone: 'info' },
  connected: { label: 'เชื่อมต่อแล้ว (จำลอง)', tone: 'success' },
  sync_failed: { label: 'ซิงก์ไม่สำเร็จ', tone: 'error' },
  disconnected: { label: 'ยกเลิกการเชื่อมต่อแล้ว', tone: 'neutral' },
};

/** แจ้งชัดเจนว่าไม่มีการเชื่อมต่อ API จริง (D1) */
export function MarketplaceDisclaimer({ className }: { className?: string }) {
  return (
    <Alert tone="warning" icon={Unplug} title="Marketplace แบบจำลอง — ยังไม่มีการเชื่อมต่อ API จริง" className={className}>
      {MARKETPLACE_DISCLAIMER}
    </Alert>
  );
}

/**
 * หน้าขอความยินยอมแบบจำลอง — ใช้ทั้งการเชื่อมต่อจากหน้า Marketplace และการนำเข้าข้อมูลตอนลงทะเบียนร้าน
 * ไม่มีการเปิดหน้าเข้าสู่ระบบของแพลตฟอร์มจริง
 */
export function ConsentModal({
  platform,
  open,
  mode = 'connect',
  defaultArchetype = 'established_good',
  onCancel,
  onConfirm,
}: {
  platform: Platform;
  open: boolean;
  mode?: 'connect' | 'import';
  defaultArchetype?: Archetype;
  onCancel: () => void;
  onConfirm: (opts: { archetype: Archetype; simulateFailure: boolean }) => void;
}) {
  const [archetype, setArchetype] = useState<Archetype>(defaultArchetype);
  const [fail, setFail] = useState(false);
  const label = PLATFORMS[platform].label;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={mode === 'import' ? `นำเข้าข้อมูลร้านจาก ${label}` : `เชื่อมต่อ ${label}`}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            ยกเลิก
          </Button>
          <Button icon={PlugZap} onClick={() => onConfirm({ archetype, simulateFailure: fail })}>
            ยินยอมและเชื่อมต่อ (จำลอง)
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-ink">
          SME Trust (ระบบสาธิต) ขอเข้าถึงข้อมูลต่อไปนี้จาก <b>{label}</b> เพื่อใช้ประกอบการประเมินความน่าเชื่อถือ — ร้านค้ายกเลิกการเชื่อมต่อได้ทุกเมื่อ
        </p>
        <ul className="space-y-1.5">
          {CONSENT_SCOPES.map((s) => (
            <li key={s} className="flex gap-2 text-ink">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              {s}
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-bg p-2.5 text-xs text-ink-soft">{MARKETPLACE_DISCLAIMER}</p>
        <div className="space-y-2 rounded-xl border border-dashed border-secondary/40 bg-secondary-50/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-secondary">
            <FlaskConical className="h-3.5 w-3.5" />
            สำหรับการสาธิต
          </p>
          <label className="block text-xs text-ink">
            ลักษณะข้อมูลจำลองของร้าน
            <select value={archetype} onChange={(e) => setArchetype(e.target.value as Archetype)} className="mt-1 h-10 w-full rounded-lg border border-line bg-white px-2 text-sm">
              {(Object.keys(ARCHETYPE_LABEL) as Archetype[]).map((a) => (
                <option key={a} value={a}>
                  {ARCHETYPE_LABEL[a].label} — {ARCHETYPE_LABEL[a].desc}
                </option>
              ))}
            </select>
          </label>
          {mode === 'connect' && (
            <label className="flex items-center gap-2 text-xs text-ink">
              <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} className="h-4 w-4 accent-primary" />
              จำลองการซิงก์ไม่สำเร็จ (เพื่อสาธิตการลองใหม่)
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}
