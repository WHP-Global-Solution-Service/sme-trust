import { useMemo } from 'react';
import { Download, FileBarChart } from 'lucide-react';
import { useCertificationStore, useComplaintStore, useMerchantStore, useWarningStore, toast } from '@/stores';
import { CERT_STATUS, REGISTRATION_STATUS, RISK_STATUS } from '@/constants/labels';
import { currentCert } from '@/utils/trust';
import { downloadText, toCsv } from '@/utils/download';
import { Alert, Button, Card, CardHeader, PageHeader, StatusBadge } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { ChartTable, HBarChart } from '@/components/common/Charts';

export default function ReportsPage() {
  const merchants = useMerchantStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const warnings = useWarningStore((s) => s.items);
  const certs = useCertificationStore((s) => s.items);

  const rows = useMemo(
    () =>
      merchants.map((m) => {
        const cs = complaints.filter((c) => c.merchantId === m.id);
        const cert = currentCert(certs, m.id);
        return {
          id: m.id,
          m,
          cert,
          total: cs.length,
          resolved: cs.filter((c) => c.status === 'resolved').length,
          escalated: cs.filter((c) => c.status === 'escalated' || c.escalationReason).length,
          open: cs.filter((c) => !['resolved', 'closed', 'escalated'].includes(c.status)).length,
          warnings: warnings.filter((w) => w.merchantId === m.id).length,
        };
      }),
    [merchants, complaints, warnings, certs],
  );

  const exportCsv = () => {
    const data = [
      ['รหัสร้าน', 'ชื่อร้าน', 'จังหวัด', 'สถานะลงทะเบียน', 'ใบรับรอง', 'สถานะใบรับรอง', 'สถานะความเสี่ยง', 'ข้อร้องเรียน', 'แก้ไขสำเร็จ', 'ส่งต่อ', 'คำเตือน/คำแนะนำ'],
      ...rows.map((r) => [r.m.id, r.m.shopName, r.m.province, REGISTRATION_STATUS[r.m.registrationStatus].label, r.cert?.id ?? '-', r.cert ? CERT_STATUS[r.cert.status].label : '-', RISK_STATUS[r.m.riskStatus].label, r.total, r.resolved, r.escalated, r.warnings]),
    ];
    downloadText(`sme-trust-report-demo-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data), 'text/csv');
    toast.success('ส่งออกรายงานแล้ว', 'ไฟล์ CSV สร้างในเบราว์เซอร์ (ข้อมูลสาธิต)');
  };

  const chart = rows.filter((r) => r.total).map((r) => ({ name: r.m.shopName, value: r.total })).sort((a, b) => b.value - a.value);

  return (
    <div>
      <PageHeader title="Reports" subtitle="สรุปข้อมูลรายร้านค้า" icon={FileBarChart} action={<Button icon={Download} onClick={exportCsv}>Export CSV</Button>} />
      <Alert tone="warning" className="mb-4">รายงานจากข้อมูลสาธิต ไม่ใช่สถิติจริงของหน่วยงานใด</Alert>
      <Card className="mb-4">
        <CardHeader title="จำนวนข้อร้องเรียนต่อร้านค้า" />
        <div className="p-4">
          <HBarChart data={chart} />
          <ChartTable data={chart} valueLabel="เรื่อง" />
        </div>
      </Card>
      <Card>
        <DataTable
          rows={rows}
          rowLink={(r) => `/shop/${r.m.id}`}
          mobileTitle={(r) => r.m.shopName}
          columns={[
            { key: 'shop', header: 'ร้านค้า', render: (r) => r.m.shopName, sort: (r) => r.m.shopName, hideOnMobile: true },
            { key: 'reg', header: 'ลงทะเบียน', render: (r) => <StatusBadge map={REGISTRATION_STATUS} value={r.m.registrationStatus} /> },
            { key: 'cert', header: 'ใบรับรอง', render: (r) => (r.cert ? <StatusBadge map={CERT_STATUS} value={r.cert.status} /> : '-') },
            { key: 'risk', header: 'ความเสี่ยง', render: (r) => <StatusBadge map={RISK_STATUS} value={r.m.riskStatus} /> },
            { key: 'total', header: 'ร้องเรียน', render: (r) => r.total, sort: (r) => r.total },
            { key: 'res', header: 'แก้ไขสำเร็จ', render: (r) => r.resolved, sort: (r) => r.resolved },
            { key: 'esc', header: 'ส่งต่อ', render: (r) => r.escalated, sort: (r) => r.escalated },
            { key: 'w', header: 'คำเตือน', render: (r) => r.warnings, sort: (r) => r.warnings },
          ]}
        />
      </Card>
    </div>
  );
}
