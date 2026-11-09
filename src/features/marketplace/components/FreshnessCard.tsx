import { withoutInternalPoints } from '@/features/trust-assessment/publicView';
import { useEffect } from 'react';
import { Clock, FlaskConical, Loader2, RefreshCw } from 'lucide-react';
import type { MarketplaceConnection } from '../types';
import { useAssessmentConfigStore } from '@/stores/assessmentConfig';
import { useMarketplaceStore } from '@/stores';
import { completeSync, currentInputs, DATA_AGE_PRESETS, resyncMarketplace, simulateDataAge, type DataAgePreset } from '@/stores/workflowsV2';
import { assessTrust } from '@/features/trust-assessment/engine';
import { currentModel } from '@/stores/assessmentConfig';
import { CONFIDENCE_LABEL } from '@/features/trust-assessment/labels';
import { MODEL_V2 } from '@/features/trust-assessment/model';
import { Badge, Button, Card, CardHeader } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';

const DAY = 86_400_000;
const SOURCE_LABEL = { seed: 'ข้อมูลตัวอย่างเริ่มต้นของ Demo', sync: 'ผู้ใช้กดซิงก์ (จำลอง)', simulated_age: 'จำลองอายุข้อมูลเพื่อการสาธิต' } as const;

export const ageInDays = (iso?: string, now = Date.now()) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY)) : undefined);

export function freshnessOf(days?: number): { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' } {
  const K = MODEL_V2.confidence;
  if (days === undefined) return { label: 'ยังไม่มีข้อมูลที่ซิงก์สำเร็จ', tone: 'neutral' };
  if (days <= K.freshFullDays) return { label: `ข้อมูลใหม่ (${days} วัน)`, tone: 'success' };
  if (days <= K.freshPartialDays) return { label: `ข้อมูลเกิน ${K.freshFullDays} วัน (${days} วัน)`, tone: 'warning' };
  return { label: `ข้อมูลเก่าเกิน ${K.freshPartialDays} วัน (${days} วัน)`, tone: 'error' };
}

/**
 * ความใหม่ของข้อมูล (P7-D) — อายุข้อมูล ที่มาของวันที่ซิงก์ และ Data Confidence ที่คำนวณใหม่จากข้อมูลปัจจุบัน
 * ซิงก์ใหม่ใช้การเชื่อมต่อและ Seed เดิม (ไม่สร้างข้อมูลซ้ำ ไม่เรียก API จริง)
 */
export function FreshnessCard({ connection: c }: { connection: MarketplaceConnection }) {
  // คำนวณใหม่เมื่อข้อมูลการเชื่อมต่อหรือน้ำหนักเปลี่ยน
  useMarketplaceStore((s) => s.items);
  useAssessmentConfigStore((s) => s.revision);
  const cur = currentInputs(c.merchantId);
  const live = cur ? assessTrust(cur.input, currentModel()) : undefined;
  const days = c.status === 'connected' ? ageInDays(c.lastSyncAt) : undefined;
  const f = freshnessOf(days);

  // ซิงก์จำลองบนหน้านี้ — เสร็จหลังแสดงสถานะ "กำลังซิงก์" ครู่หนึ่ง
  useEffect(() => {
    if (c.status !== 'syncing') return;
    const t = setTimeout(() => completeSync(c.id, true), 900);
    return () => clearTimeout(t);
  }, [c.status, c.id]);

  return (
    <Card data-testid="freshness">
      <CardHeader title="ความใหม่ของข้อมูลและ Data Confidence" icon={Clock} subtitle="ข้อมูลเก่าทำให้ความเชื่อมั่นลดลง แต่ไม่ลดความครอบคลุม" />
      <div className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={f.tone}>{f.label}</Badge>
          {c.lastSyncAt && (
            <span className="text-xs text-ink-soft">
              ซิงก์ล่าสุด {fmtDate(c.lastSyncAt, true)} · ที่มา: {SOURCE_LABEL[c.syncSource ?? 'seed']}
            </span>
          )}
        </div>
        {live && (
          <div className="rounded-lg bg-bg p-3" role="status">
            <p className="font-medium text-ink">
              Data Confidence ปัจจุบัน: {CONFIDENCE_LABEL[live.confidence.level].label}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
              {live.confidence.reasons.map((r) => (
                <li key={r}>• {withoutInternalPoints(r)}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink-soft">คำนวณใหม่จากข้อมูลล่าสุดทุกครั้งที่เปิดหน้านี้ — ผลประเมินที่บันทึกไว้ไม่เปลี่ยนจนกว่าจะกด "ประเมินใหม่"</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {c.status === 'syncing' ? (
            <p className="flex items-center gap-2 text-info">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังซิงก์ข้อมูลจำลอง…
            </p>
          ) : (
            <Button variant="outline" icon={RefreshCw} onClick={() => resyncMarketplace(c.id)}>
              ซิงก์ข้อมูล (จำลอง)
            </Button>
          )}
        </div>
        <fieldset className="rounded-xl border border-dashed border-secondary/40 bg-secondary-50/40 p-3">
          <legend className="flex items-center gap-1 px-1 text-xs font-semibold text-secondary">
            <FlaskConical className="h-3.5 w-3.5" /> เครื่องมือสาธิต: จำลองอายุข้อมูล
          </legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DATA_AGE_PRESETS) as DataAgePreset[]).map((k) => (
              <Button key={k} size="sm" variant="ghost" title={DATA_AGE_PRESETS[k].desc} onClick={() => simulateDataAge(c.id, k)} disabled={c.status === 'syncing'}>
                {DATA_AGE_PRESETS[k].label}
              </Button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-soft">ใช้เพื่อแสดงผลของอายุข้อมูลต่อ Confidence เท่านั้น — บันทึกใน Audit Log ว่าเป็นการจำลอง</p>
        </fieldset>
      </div>
    </Card>
  );
}
