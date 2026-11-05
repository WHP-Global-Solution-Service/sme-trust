import { useAssessmentStore, useImportRecordStore, useMarketplaceStore, useMerchantStore, useOperatorStore } from '@/stores';
import { BAND_LABEL, CONFIDENCE_LABEL } from '@/features/trust-assessment/labels';
import { ImportReviewPanel } from './ImportProvenance';
import { ChangeRequestNotice } from '@/features/profile-change/ProfileChangeParts';

/**
 * มุมเจ้าหน้าที่: ข้อมูลที่ร้านนำเข้าจาก Marketplace (จำลอง) เทียบกับข้อมูลที่ส่ง
 * - คำขอลงทะเบียน: ใช้บันทึกที่ผูกกับคำขอ (importId)
 * - ผลประเมินของร้านเดิม: ใช้บันทึกการอัปเดตโปรไฟล์ล่าสุดของร้าน (Scenario 9)
 */
export function ImportReviewSection({ merchantId, importId, className }: { merchantId: string; importId?: string; className?: string }) {
  const records = useImportRecordStore((s) => s.items);
  const record = importId
    ? records.find((r) => r.id === importId)
    : records.filter((r) => r.merchantId === merchantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  const connection = useMarketplaceStore((s) => s.items.find((c) => c.id === record?.connectionId));
  const merchant = useMerchantStore((s) => s.items.find((m) => m.id === merchantId));
  const op = useOperatorStore((s) => s.items.find((o) => o.id === merchant?.operatorId));
  const latest = useAssessmentStore((s) => s.items.filter((a) => a.merchantId === merchantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0]);
  if (!record) return null;
  const assessmentLabel = latest ? `${BAND_LABEL[latest.result.band].label} · ความเชื่อมั่น${CONFIDENCE_LABEL[latest.result.confidence.level].label} (${latest.id})` : undefined;
  return (
    <div className={className}>
      {record.changeRequestId && <ChangeRequestNotice merchantId={merchantId} role="officer" className="mb-3" />}
      <ImportReviewPanel record={record} connection={connection} assessmentLabel={assessmentLabel} identityVerified={op?.kycStatus === 'verified'} />
    </div>
  );
}
