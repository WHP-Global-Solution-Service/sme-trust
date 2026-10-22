import { useState } from 'react';
import { Store } from 'lucide-react';
import { BUSINESS_CATEGORIES, PROVINCES } from '@/constants/labels';
import { PageHeader, Tabs } from '@/components/common/ui';
import { SearchBox, Select } from '@/components/forms/Field';
import { MerchantCard, NotFoundExplain, VERDICT_FILTERS, filterMerchants, usePublicMerchants } from './shared';

/** Merchant Directory — ส่งเสริม SME ที่ผ่านการตรวจสอบ */
export default function DirectoryPage() {
  const all = usePublicMerchants();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [province, setProvince] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'level' | 'name'>('level');

  const list = filterMerchants(all, { q, category, province, status }).sort((a, b) =>
    sort === 'name' ? a.merchant.shopName.localeCompare(b.merchant.shopName, 'th') : Number(b.verdict.usable) - Number(a.verdict.usable) || b.level - a.level,
  );

  return (
    <div>
      <PageHeader title="ทำเนียบร้านค้า (Merchant Directory)" subtitle="ร้านค้าที่ลงทะเบียนในระบบสาธิต — กดเพื่อดูโปรไฟล์และช่องทางขายเดิม" icon={Store} />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาชื่อร้าน / ชื่อบัญชี" />
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="หมวด">
            <option value="">ทุกหมวด</option>
            {BUSINESS_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={province} onChange={(e) => setProvince(e.target.value)} aria-label="จังหวัด">
            <option value="">ทุกจังหวัด</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as 'level' | 'name')} aria-label="เรียงลำดับ" className="col-span-2 lg:w-44">
            <option value="level">เรียงตามระดับการตรวจสอบ</option>
            <option value="name">เรียงตามชื่อ</option>
          </Select>
        </div>
      </div>
      <div className="mb-4">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={VERDICT_FILTERS.map((f) => ({ value: f.value, label: f.label, count: f.value ? all.filter((x) => x.verdict.key === f.value).length : all.length }))}
        />
      </div>
      {list.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((x) => (
            <MerchantCard key={x.merchant.id} x={x} />
          ))}
        </div>
      ) : (
        <NotFoundExplain query={q} />
      )}
    </div>
  );
}
