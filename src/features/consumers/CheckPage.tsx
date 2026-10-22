import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquareWarning, QrCode, Search, ShieldCheck } from 'lucide-react';
import { BUSINESS_CATEGORIES, PROVINCES } from '@/constants/labels';
import { Badge, Button, Card, LinkButton, SectionTitle, SkeletonList } from '@/components/common/ui';
import { VerdictBadge } from '@/components/common/Trust';
import { VERDICTS, type VerdictKey } from '@/utils/trust';
import { Input, Select } from '@/components/forms/Field';
import { MerchantCard, NotFoundExplain, VERDICT_FILTERS, filterMerchants, usePublicMerchants } from './shared';

/** Consumer Landing + Search Merchant (ไม่ต้องเข้าสู่ระบบ) */
export default function CheckPage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const all = usePublicMerchants();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState('');
  const [province, setProvince] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const submitted = params.get('q') !== null;

  const query = params.get('q') ?? '';
  const results = filterMerchants(all, { q: query, category, province, status });

  useEffect(() => {
    if (!submitted) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 450); // Skeleton Loading จำลอง
    return () => clearTimeout(t);
  }, [query, category, province, status, submitted]);

  return (
    <div>
      <section className="mb-6 rounded-2xl bg-primary p-5 text-white sm:p-8">
        <ShieldCheck className="h-9 w-9" />
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">ตรวจสอบร้านค้าก่อนซื้อ</h1>
        <p className="mt-1 text-white/80">ค้นหาร้านค้าออนไลน์เพื่อดูสถานะการยืนยันตัวตนและการรับรอง (ข้อมูลสาธิต)</p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q });
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อร้าน ชื่อเพจ หรือหมวดสินค้า" className="border-0 text-ink" />
          <Button type="submit" size="md" icon={Search} variant="inverse" className="shrink-0">
            ค้นหา
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton to="/verify" size="sm" variant="inverseOutline" icon={QrCode}>
            สแกน QR ใบรับรอง
          </LinkButton>
          <LinkButton to="/report" size="sm" variant="inverseOutline" icon={MessageSquareWarning}>
            แจ้งปัญหาการซื้อขาย
          </LinkButton>
        </div>
      </section>

      {submitted ? (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="หมวดสินค้า">
              <option value="">ทุกหมวดสินค้า</option>
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
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="สถานะการรับรอง">
              {VERDICT_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="mb-3 text-sm text-ink-soft">
            ผลการค้นหา{query && ` "${query}"`}: {loading ? '...' : `${results.length} ร้าน`}
          </p>
          {loading ? (
            <Card>
              <SkeletonList rows={3} />
            </Card>
          ) : results.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((x) => (
                <MerchantCard key={x.merchant.id} x={x} />
              ))}
            </div>
          ) : (
            <NotFoundExplain query={query} />
          )}
        </>
      ) : (
        <>
          <SectionTitle action={<Button variant="ghost" size="sm" onClick={() => nav('/directory')}>ดูทั้งหมด</Button>}>ร้านค้าที่ได้รับการรับรอง</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {all
              .filter((x) => x.verdict.key === 'certified')
              .map((x) => (
                <MerchantCard key={x.merchant.id} x={x} />
              ))}
          </div>
          <SectionTitle>วิธีอ่านผลการตรวจสอบ</SectionTitle>
          <Card className="divide-y divide-line">
            {(Object.keys(VERDICTS) as VerdictKey[])
              .filter((k) => k !== 'unverified')
              .map((k) => (
                <div key={k} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="shrink-0 sm:w-48">
                    <VerdictBadge verdict={{ key: k, ...VERDICTS[k] }} size="sm" />
                  </div>
                  <p className="text-sm text-ink-soft">{VERDICTS[k].desc}</p>
                </div>
              ))}
            <div className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="shrink-0 sm:w-48">
                <Badge tone="neutral">ไม่พบข้อมูล</Badge>
              </div>
              <p className="text-sm text-ink-soft">ไม่ได้หมายความว่าร้านค้ากระทำผิด อาจยังไม่ได้ลงทะเบียนกับระบบ ควรตรวจสอบข้อมูลผู้ขายก่อนซื้อ</p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
