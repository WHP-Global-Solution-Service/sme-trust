import { useNavigate } from 'react-router-dom';
import { toast } from '@/stores';
import { setKycResult } from '@/stores/workflows';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { Alert, Card, PageHeader } from '@/components/common/ui';
import { EKycFlow } from './EKycFlow';

export default function KycPage() {
  const nav = useNavigate();
  const op = useCurrentOperator();
  if (!op) return null;
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="ยืนยันตัวตน (Mock e-KYC)" back={{ to: '/m', label: 'หน้าหลัก' }} />
      {op.kycStatus === 'verified' ? (
        <Alert tone="success" title="ยืนยันตัวตนแล้ว">บัญชีนี้ได้รับสถานะ Level 1 — Identity Verified แล้ว</Alert>
      ) : (
        <Card className="p-5">
          <EKycFlow
            onDone={(ok) => {
              setKycResult(op.id, ok);
              if (ok) toast.success('ยืนยันตัวตนสำเร็จ');
              else toast.error('ยังไม่ได้ยืนยันตัวตน', 'สามารถลองใหม่ได้ภายหลัง');
              nav('/m');
            }}
          />
        </Card>
      )}
    </div>
  );
}
