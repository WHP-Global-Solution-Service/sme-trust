import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, FlaskConical, KeyRound, ShieldCheck, Store } from 'lucide-react';
import type { MockDocument } from '@/types';
import type { Platform } from '@/features/marketplace/types';
import { CONSENT_SCOPES, MARKETPLACE_DISCLAIMER, PLATFORM_LIST, PLATFORMS } from '@/features/marketplace/data/platforms';
import { importedValues, mockAccountShops, sourceOfShop, type ImportSource } from '@/features/marketplace/autofill';
import { SourceDataCard } from '@/features/marketplace/components/ImportProvenance';
import { importFlowKey } from '@/stores/workflowsV2';
import { reportDemo } from '@/stores/demo';
import { confirmDialog, toast, useMarketplaceStore, useMerchantStore, useSessionStore } from '@/stores';
import { Link } from 'react-router-dom';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { uid } from '@/utils/id';
import { cn } from '@/utils/cn';
import { Alert, Badge, Button, Card, PageHeader } from '@/components/common/ui';

const STEPS = ['เลือก Marketplace', 'อนุญาตเข้าถึง (จำลอง)', 'เลือกร้านค้า', 'ตรวจข้อมูลก่อนนำเข้า'];

interface FlowState {
  platform?: Platform;
  shopKey?: string;
  agree?: boolean;
}

/** ค่าเริ่มต้นของแบบฟอร์มเมื่อสมัครด้วยข้อมูลที่นำเข้า — ช่องที่ไม่มีในแหล่งข้อมูลเว้นว่าง (ต้องกรอกเพิ่ม) */
export function importFormDefaults(op: { name: string }) {
  return {
    businessType: 'individual' as const,
    identityDocType: 'id_card' as const,
    ownerName: op.name,
    companyName: '',
    registrationNo: '',
    companyType: '',
    authorizedPerson: '',
    applicantName: op.name,
    shopName: '',
    category: '',
    province: '',
    district: '',
    address: '',
    phone: '',
    email: '',
    description: '',
    channels: [] as { type: string; handle: string }[],
    agree: false,
  };
}

/**
 * ลงทะเบียนร้านใหม่ด้วยข้อมูลจาก Marketplace (จำลอง): เลือกแพลตฟอร์ม → อนุญาต (จำลอง) → เลือกร้าน → Preview → ยืนยันนำเข้า
 * ไม่มีหน้า Login ของแพลตฟอร์ม ไม่ขอรหัสผ่าน/Token และไม่เรียก API — ยืนยันแล้วไปเติมแบบฟอร์มลงทะเบียน (ยังไม่ส่งคำขอ)
 */
export default function MarketplaceRegistrationPage() {
  const nav = useNavigate();
  const op = useCurrentOperator()!;
  const key = importFlowKey(op.id);
  const saved = useSessionStore((s) => s.shopDrafts[key]);
  const wizardDraft = useSessionStore((s) => s.shopDrafts[op.id]);
  const saveDraft = useSessionStore((s) => s.saveDraft);
  const step = saved?.step ?? 0;
  const flow = (saved?.data ?? {}) as FlowState;

  // บันทึกความคืบหน้าทุกขั้น (Refresh แล้วกลับมาที่เดิม)
  const setFlow = (nextStep: number, patch: FlowState = {}) => saveDraft(key, { step: nextStep, data: { ...flow, ...patch }, savedAt: new Date().toISOString() });
  useEffect(() => reportDemo('reg.flow', step), [step]);

  const shops = useMemo(() => (flow.platform ? mockAccountShops(op.id, op.name, flow.platform) : []), [flow.platform, op.id, op.name]);
  // Shop ID เดียวกันเชื่อมกับร้านใดในระบบอยู่แล้วหรือไม่ (ไม่ตัดสินจากชื่อร้าน)
  const connections = useMarketplaceStore((s) => s.items);
  const merchants = useMerchantStore((s) => s.items);
  const claimOf = (mockShopId: string, platform: Platform) => {
    const c = connections.find((x) => x.platform === platform && x.mockShopId === mockShopId && x.status !== 'disconnected' && x.identityReview?.status !== 'rejected');
    const m = c && merchants.find((x) => x.id === c.merchantId);
    return m ? { merchant: m, own: m.operatorId === op.id } : undefined;
  };
  const shopRaw = shops.find((s) => s.key === flow.shopKey);
  // ร้านที่เชื่อมกับร้านของบัญชีนี้แล้วเลือกนำเข้าซ้ำไม่ได้ (กันการสร้างร้านซ้ำโดยไม่ตั้งใจ)
  const shop = shopRaw && !claimOf(shopRaw.mockShopId, shopRaw.platform)?.own ? shopRaw : undefined;
  const preview = useMemo(() => (shop ? sourceOfShop(shop) : undefined), [shop]);

  const confirmImport = async () => {
    if (!preview) return;
    const prev = wizardDraft?.data as (Record<string, unknown> & { importSource?: ImportSource; docs?: MockDocument[]; draftId?: string }) | undefined;
    const prevSrc = prev?.importSource;
    if (prevSrc && prevSrc.key !== preview.key) {
      const r = await confirmDialog({
        title: 'แทนที่ข้อมูลที่นำเข้าไว้เดิม?',
        body: `ฉบับร่างมีข้อมูลจาก ${PLATFORMS[prevSrc.platform].label} ร้าน "${prevSrc.shopName}" — ชื่อร้าน คำอธิบาย และหมวดหมู่จะถูกแทนด้วยข้อมูลจาก ${PLATFORMS[preview.platform].label} ร้าน "${preview.shopName}" (ช่องติดต่อ ที่อยู่ และเอกสารที่กรอกไว้ยังอยู่)`,
        confirmText: 'แทนที่ข้อมูล',
      });
      if (!r.ok) return;
    } else if (!prevSrc && prev && ['shopName', 'description', 'category'].some((k) => String(prev[k] ?? '').trim())) {
      const r = await confirmDialog({
        title: 'แทนข้อมูลร้านที่กรอกไว้?',
        body: 'ฉบับร่างมีชื่อร้าน คำอธิบาย หรือหมวดหมู่ที่กรอกไว้แล้ว — ข้อมูลเหล่านี้จะถูกแทนด้วยข้อมูลที่นำเข้า (แก้ไขต่อได้ก่อนส่งคำขอ)',
        confirmText: 'แทนที่ข้อมูล',
      });
      if (!r.ok) return;
    }
    const base = prev ? { ...importFormDefaults(op), ...prev } : importFormDefaults(op);
    const keepChannels = ((base.channels as { type: string; handle: string }[]) ?? []).filter((c) => c.handle.trim() && c.handle !== prevSrc?.shopUrl);
    const data = {
      ...base,
      ...importedValues(preview),
      channels: [...keepChannels, { type: 'marketplace', handle: preview.shopUrl }],
      agree: false,
      docs: prev?.docs ?? [],
      importSource: preview,
      draftId: prev?.draftId ?? uid('DRF'),
    };
    saveDraft(op.id, { step: 2, data, savedAt: new Date().toISOString() });
    saveDraft(key, undefined);
    reportDemo('reg.imported', 1);
    toast.success(`นำเข้าข้อมูลจาก ${PLATFORMS[preview.platform].label} แล้ว`, 'ตรวจสอบ แก้ไข และกรอกข้อมูลที่ขาดก่อนส่งคำขอ');
    nav('/m/register-shop?from=import');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="ลงทะเบียนร้านค้าใหม่ด้วยข้อมูลจาก Marketplace" subtitle="เส้นทางสมัครร้านใหม่ — เริ่มที่ Level 1–2 ตามขั้นตอนปกติ" back={{ to: '/m/register-shop', label: 'แบบฟอร์มลงทะเบียน' }} />
      <Alert tone="info" className="mb-4" title="การเชื่อมต่อจำลอง (Simulation)">
        {MARKETPLACE_DISCLAIMER}
      </Alert>
      <ol className="mb-4 grid grid-cols-4 gap-1" aria-label="ขั้นตอนนำเข้าข้อมูล">
        {STEPS.map((s, i) => (
          <li key={s} className="min-w-0">
            <span className={cn('block h-1.5 rounded-full', i <= step ? 'bg-primary' : 'bg-line')} />
            <span className={cn('mt-1 block truncate text-[11px]', i === step ? 'font-semibold text-primary' : 'text-ink-soft')}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      <Card className="p-5">
        {step === 0 && (
          <div className="space-y-3">
            <p className="font-semibold text-ink">ร้านของคุณขายอยู่บนแพลตฟอร์มใด</p>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="เลือก Marketplace">
              {PLATFORM_LIST.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={flow.platform === p}
                  onClick={() => setFlow(0, { platform: p, shopKey: undefined, agree: false })}
                  className={cn('flex items-center gap-3 rounded-xl border-2 p-4 text-left', flow.platform === p ? 'border-primary bg-primary-50/50' : 'border-line hover:border-primary/30')}
                >
                  <Store className="h-6 w-6 text-primary" aria-hidden />
                  <span className="flex-1 font-semibold text-ink">{PLATFORMS[p].label}</span>
                  {flow.platform === p && <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-soft">ไม่ได้ขายบนแพลตฟอร์มเหล่านี้? กลับไปเลือก "ลงทะเบียนด้วยตนเอง" ในแบบฟอร์ม</p>
          </div>
        )}

        {step === 1 && flow.platform && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden />
              <p className="font-semibold text-ink">หน้าจออนุญาตเข้าถึงข้อมูล (จำลอง)</p>
              <Badge tone="warning">Simulation</Badge>
            </div>
            <p className="rounded-lg border border-dashed border-secondary/40 bg-secondary-50/50 p-3 text-sm text-ink">
              นี่ไม่ใช่หน้า Login ของ {PLATFORMS[flow.platform].short} — ระบบสาธิต<b>ไม่ขอและไม่เก็บ</b> ชื่อผู้ใช้ รหัสผ่าน หรือ Token ใด ๆ
              ในระบบจริง ผู้ประกอบการจะยืนยันสิทธิ์บนเว็บไซต์ของแพลตฟอร์มเอง แล้วแพลตฟอร์มส่งสิทธิ์การเข้าถึงกลับมา
            </p>
            <p className="text-sm text-ink">
              SME Trust (ระบบสาธิต) ขอเข้าถึงข้อมูลร้านจาก <b>{PLATFORMS[flow.platform].label}</b> เพื่อเติมแบบฟอร์มลงทะเบียนและประกอบการประเมิน:
            </p>
            <ul className="space-y-1.5 text-sm">
              {CONSENT_SCOPES.map((s) => (
                <li key={s} className="flex gap-2 text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm text-ink">
              <input type="checkbox" checked={!!flow.agree} onChange={(e) => setFlow(1, { agree: e.target.checked })} className="mt-0.5 h-4 w-4 accent-primary" />
              ข้าพเจ้าอนุญาตให้ SME Trust (จำลอง) เข้าถึงข้อมูลร้านตามขอบเขตข้างต้น
            </label>
          </div>
        )}

        {step === 2 && flow.platform && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <ShieldCheck className="h-5 w-5 text-success" aria-hidden />
              อนุญาตแล้ว (จำลอง) — พบ {shops.length} ร้านในบัญชี {PLATFORMS[flow.platform].label}
            </p>
            <div className="grid gap-2" role="radiogroup" aria-label="ร้านค้าในบัญชี">
              {shops.map((s) => {
                const claim = claimOf(s.mockShopId, s.platform);
                return (
                  <div key={s.key}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={flow.shopKey === s.key}
                      aria-disabled={claim?.own || undefined}
                      disabled={claim?.own}
                      onClick={() => setFlow(2, { shopKey: s.key })}
                      className={cn('w-full rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60', flow.shopKey === s.key && !claim?.own ? 'border-primary bg-primary-50' : 'border-line hover:bg-bg')}
                    >
                      <span className="block font-medium text-ink">{s.shopName}</span>
                      <span className="block text-xs text-ink-soft">
                        Shop ID จำลอง {s.mockShopId} · {s.category} · {s.note}
                      </span>
                    </button>
                    {claim?.own && (
                      <p className="mt-1 text-xs text-ink-soft" data-testid="shop-claimed-own">
                        เชื่อมกับร้าน "{claim.merchant.shopName}" ({claim.merchant.id}) ของคุณแล้ว — ไม่ต้องสมัครร้านใหม่ ·{' '}
                        <Link to="/m/marketplace" className="font-medium text-primary hover:underline">
                          จัดการช่องทางขายของร้านเดิม
                        </Link>
                      </p>
                    )}
                    {claim && !claim.own && (
                      <p className="mt-1 text-xs text-warning" data-testid="shop-claimed-other">
                        Shop ID นี้เชื่อมกับร้านอื่นในระบบแล้ว — นำเข้าได้ แต่ระบบจะส่งเจ้าหน้าที่ตรวจความเป็นเจ้าของ (ไม่รวมร้านอัตโนมัติ)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="flex items-center gap-1.5 text-xs text-secondary">
              <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ร้านในบัญชีเป็นข้อมูลจำลองที่สร้างจากรหัสบัญชีสาธิต
            </p>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-3">
            <p className="text-sm text-ink">ข้อมูลที่จะนำเข้า — ระบบยังไม่นำข้อมูลไปใช้จนกว่าจะกด "ยืนยันนำเข้าข้อมูล" และยังไม่ส่งคำขอลงทะเบียน</p>
            <SourceDataCard source={preview} />
            <div className="rounded-xl border border-line p-3 text-sm">
              <p className="mb-1 font-semibold text-ink">จะเติมลงแบบฟอร์มอัตโนมัติ</p>
              <p className="text-ink-soft">ชื่อร้าน · คำอธิบายร้าน · หมวดหมู่ธุรกิจ · ลิงก์ร้านเป็นช่องทางขาย</p>
              <p className="mt-2 mb-1 font-semibold text-ink">ไม่มีในแหล่งข้อมูล — ต้องกรอกเพิ่ม</p>
              <p className="text-ink-soft">เบอร์โทรศัพท์ · อีเมล · จังหวัด/อำเภอ · ที่อยู่ธุรกิจ · เอกสารประกอบ</p>
              <p className="mt-2 text-xs text-ink-soft">ข้อมูลผู้ประกอบการมาจากบัญชีที่ยืนยันตัวตนแล้ว (Mock e-KYC) — ระบบไม่สร้างข้อมูลเจ้าของร้านหรือเอกสารยืนยันตัวตนจากแพลตฟอร์ม</p>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" icon={ChevronLeft} onClick={() => (step === 0 ? nav('/m/register-shop') : setFlow(step - 1))}>
          {step === 0 ? 'กลับไปแบบฟอร์ม' : 'ย้อนกลับ'}
        </Button>
        {step === 0 && (
          <Button className="ml-auto" icon={ChevronRight} disabled={!flow.platform} onClick={() => setFlow(1)}>
            ถัดไป
          </Button>
        )}
        {step === 1 && (
          <Button className="ml-auto" icon={ShieldCheck} disabled={!flow.agree} onClick={() => setFlow(2)}>
            อนุญาต (จำลอง)
          </Button>
        )}
        {step === 2 && (
          <Button className="ml-auto" icon={Eye} disabled={!shop} onClick={() => setFlow(3)}>
            ดูตัวอย่างข้อมูล
          </Button>
        )}
        {step === 3 && (
          <Button className="ml-auto" icon={Download} onClick={confirmImport}>
            ยืนยันนำเข้าข้อมูล
          </Button>
        )}
      </div>
    </div>
  );
}
