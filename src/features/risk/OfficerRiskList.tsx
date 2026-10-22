import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShieldAlert } from 'lucide-react';
import { useComplaintStore, useMerchantStore, useRiskStore, toast } from '@/stores';
import { openRiskCase } from '@/stores/workflows';
import { RISK_STATUS } from '@/constants/labels';
import { fmtDate } from '@/utils/format';
import { Alert, Button, Card, PageHeader, StatusBadge } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { Field, SearchBox, Select, Textarea } from '@/components/forms/Field';

export default function OfficerRiskList() {
  const nav = useNavigate();
  const risks = useRiskStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const complaints = useComplaintStore((s) => s.items);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [mId, setMId] = useState('');
  const [reason, setReason] = useState('');
  const [cIds, setCIds] = useState<string[]>([]);
  const shop = (id: string) => merchants.find((m) => m.id === id)?.shopName ?? id;
  const rows = risks.filter((r) => !q || `${r.id} ${shop(r.merchantId)} ${r.reason}`.includes(q)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const related = complaints.filter((c) => c.merchantId === mId);

  return (
    <div>
      <PageHeader title="Risk Reviews" subtitle="ข้อกล่าวหา การตรวจสอบ การระงับ/เพิกถอน และการอุทธรณ์" icon={ShieldAlert} action={<Button icon={Plus} onClick={() => setOpen(true)}>เปิดเรื่องพิจารณา</Button>} />
      <div className="mb-3">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาเลขที่ ร้านค้า หรือเหตุผล" />
      </div>
      <Card>
        <DataTable
          rows={rows}
          rowLink={(r) => `/o/risk/${r.id}`}
          mobileTitle={(r) => shop(r.merchantId)}
          columns={[
            { key: 'id', header: 'เลขที่', render: (r) => <span className="font-mono text-xs">{r.id}</span>, sort: (r) => r.id },
            { key: 'shop', header: 'ร้านค้า', render: (r) => shop(r.merchantId), hideOnMobile: true },
            { key: 'reason', header: 'เหตุผล', render: (r) => <span className="line-clamp-2">{r.reason}</span>, hideOnMobile: true },
            { key: 'status', header: 'สถานะ', render: (r) => <StatusBadge map={RISK_STATUS} value={r.status} />, sort: (r) => r.status },
            { key: 'upd', className: 'whitespace-nowrap', header: 'อัปเดต', render: (r) => fmtDate(r.updatedAt), sort: (r) => r.updatedAt },
          ]}
        />
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="เปิดเรื่องพิจารณาความเสี่ยง"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button
              onClick={() => {
                if (!mId || reason.trim().length < 10) return toast.error('กรุณาเลือกร้านค้าและระบุเหตุผลอย่างน้อย 10 ตัวอักษร');
                const r = openRiskCase(mId, reason.trim(), cIds);
                setOpen(false);
                toast.success('เปิดเรื่องแล้ว', `${r.id} สถานะ: ข้อกล่าวหา`);
                nav(`/o/risk/${r.id}`);
              }}
            >
              บันทึกข้อกล่าวหา
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">การเปิดเรื่องเป็นเพียง "ข้อกล่าวหา" ยังไม่ใช่มาตรการ ห้ามระงับหรือ Blacklist จากข้อร้องเรียนเพียงครั้งเดียว</Alert>
          <Field label="ร้านค้า" required>
            <Select value={mId} onChange={(e) => { setMId(e.target.value); setCIds([]); }}>
              <option value="">เลือกร้านค้า</option>
              {merchants.map((m) => <option key={m.id} value={m.id}>{m.shopName} ({m.id})</option>)}
            </Select>
          </Field>
          <Field label="เหตุผล" required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {related.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">ข้อร้องเรียนที่เกี่ยวข้อง</p>
              {related.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-primary" checked={cIds.includes(c.id)} onChange={(e) => setCIds(e.target.checked ? [...cIds, c.id] : cIds.filter((x) => x !== c.id))} />
                  <span className="font-mono text-xs">{c.id}</span> {c.title}
                </label>
              ))}
              {cIds.length === 1 && <p className="text-xs text-warning">มีข้อร้องเรียนเพียง 1 เรื่อง — ควรตรวจสอบข้อเท็จจริงก่อนพิจารณามาตรการใด ๆ</p>}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
