import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Link2, Loader2, PlugZap, RefreshCw, Unplug } from 'lucide-react';
import { confirmDialog, toast, useMarketplaceStore } from '@/stores';
import { useMyMerchants } from '@/hooks/useCurrent';
import { completeSync, connectMarketplace, disconnectMarketplace, grantConsent, resyncMarketplace } from '@/stores/workflowsV2';
import { Badge, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';
import type { Archetype, MarketplaceConnection, Platform } from '../types';
import { ARCHETYPE_LABEL, PLATFORM_LIST, PLATFORMS } from '../data/platforms';
import { snapshotOf } from '../services/generator';
import { CONNECTION_STATUS, ConsentModal, MarketplaceDisclaimer } from '../components/MarketplaceParts';

/** เวลาจำลองการซิงก์ (แสดงสถานะกำลังซิงก์ ไม่ใช่การเปลี่ยนหน้าอัตโนมัติ) */
const SYNC_MS = 1200;

export default function MarketplacePage() {
  const { active: m } = useMyMerchants();
  const all = useMarketplaceStore((s) => s.items);
  const [consentFor, setConsentFor] = useState<Platform>();
  // จำลองการซิงก์ไม่สำเร็จ (ตั้งจากหน้าขอความยินยอม) — เก็บตามรหัสการเชื่อมต่อ
  const failSim = useRef<Record<string, boolean>>({});

  const mine = all.filter((c) => c.merchantId === m?.id);
  const syncing = mine.filter((c) => c.status === 'syncing').map((c) => c.id).join(',');

  // ทำให้การซิงก์ที่ค้างอยู่เสร็จ (รวมกรณีออกจากหน้าแล้วกลับมา)
  useEffect(() => {
    if (!syncing) return;
    const ids = syncing.split(',');
    const t = setTimeout(() => {
      ids.forEach((id) => {
        const ok = !failSim.current[id];
        completeSync(id, ok);
        delete failSim.current[id];
        const c = useMarketplaceStore.getState().items.find((x) => x.id === id);
        if (c) (ok ? toast.success : toast.error)(ok ? `ซิงก์ ${PLATFORMS[c.platform].label} สำเร็จ` : `ซิงก์ ${PLATFORMS[c.platform].label} ไม่สำเร็จ`, ok ? 'ประเมินความน่าเชื่อถือใหม่เพื่อใช้ข้อมูลล่าสุด' : 'กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง');
      });
    }, SYNC_MS);
    return () => clearTimeout(t);
  }, [syncing]);

  if (!m)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="เชื่อมต่อ Marketplace (จำลอง)" back={{ to: '/m', label: 'หน้าหลัก' }} />
        <EmptyState title="ยังไม่มีร้านค้า" desc="ลงทะเบียนร้านค้าก่อน แล้วจึงเชื่อมต่อข้อมูล Marketplace" action={<LinkButton to="/m/register-shop">ลงทะเบียนร้านค้า</LinkButton>} />
      </div>
    );

  const confirmConsent = ({ archetype, simulateFailure }: { archetype: Archetype; simulateFailure: boolean }) => {
    if (!consentFor) return;
    const c = connectMarketplace(m.id, consentFor, archetype);
    failSim.current[c.id] = simulateFailure;
    grantConsent(c.id, archetype);
    setConsentFor(undefined);
  };

  const disconnect = async (c: MarketplaceConnection) => {
    const r = await confirmDialog({
      title: `ยกเลิกการเชื่อมต่อ ${PLATFORMS[c.platform].label}`,
      body: 'ข้อมูลจากแพลตฟอร์มนี้จะไม่ถูกใช้ในการประเมินครั้งถัดไป และความครอบคลุมของข้อมูลจะลดลง',
      confirmText: 'ยกเลิกการเชื่อมต่อ',
      tone: 'danger',
    });
    if (!r.ok) return;
    disconnectMarketplace(c.id);
    toast.success('ยกเลิกการเชื่อมต่อแล้ว');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="เชื่อมต่อ Marketplace (จำลอง)" subtitle={`${m.shopName} — ใช้ข้อมูลการขายประกอบการประเมินความน่าเชื่อถือ`} icon={Link2} back={{ to: '/m', label: 'หน้าหลัก' }} />
      <MarketplaceDisclaimer />
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORM_LIST.map((platform) => {
          const c = mine.filter((x) => x.platform === platform).sort((a, b) => (a.status === 'disconnected' ? 1 : 0) - (b.status === 'disconnected' ? 1 : 0) || b.createdAt.localeCompare(a.createdAt))[0];
          const live = c && c.status !== 'disconnected' ? c : undefined;
          const snap = live?.status === 'connected' && live.lastSyncAt ? snapshotOf(live, m.category) : undefined;
          return (
            <Card key={platform} data-platform={platform}>
              <CardHeader title={PLATFORMS[platform].label} subtitle={live ? `รหัสร้านจำลอง ${live.mockShopId}` : 'ยังไม่ได้เชื่อมต่อ'} action={live ? <StatusBadge map={CONNECTION_STATUS} value={live.status} /> : undefined} />
              <div className="space-y-3 p-4 text-sm">
                {live?.status === 'syncing' && (
                  <p className="flex items-center gap-2 text-info">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังซิงก์ข้อมูลจำลอง…
                  </p>
                )}
                {live?.status === 'sync_failed' && <p className="text-error">{live.failReason}</p>}
                {live && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-soft">ลักษณะข้อมูลจำลอง</dt>
                    <dd className="text-ink">{ARCHETYPE_LABEL[live.archetype].label}</dd>
                    <dt className="text-ink-soft">ให้ความยินยอมเมื่อ</dt>
                    <dd className="text-ink">{live.consentAt ? fmtDate(live.consentAt, true) : '—'}</dd>
                    <dt className="text-ink-soft">ซิงก์ล่าสุด</dt>
                    <dd className="text-ink">{live.lastSyncAt ? fmtDate(live.lastSyncAt, true) : '—'}</dd>
                  </dl>
                )}
                {snap && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-bg p-2">
                      <p className="text-xs text-ink-soft">อายุร้าน</p>
                      <p className="font-semibold">{snap.shopAgeMonths} เดือน</p>
                    </div>
                    <div className="rounded-lg bg-bg p-2">
                      <p className="text-xs text-ink-soft">คำสั่งซื้อ 12 เดือน</p>
                      <p className="font-semibold">{snap.monthlyOrders.reduce((a, b) => a + b, 0).toLocaleString('th-TH')}</p>
                    </div>
                    <div className="rounded-lg bg-bg p-2">
                      <p className="text-xs text-ink-soft">รีวิว</p>
                      <p className="font-semibold">{snap.totalReviews.toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {!live && (
                    <Button icon={PlugZap} onClick={() => setConsentFor(platform)}>
                      เชื่อมต่อ {PLATFORMS[platform].label}
                    </Button>
                  )}
                  {live?.status === 'pending_consent' && (
                    <Button icon={PlugZap} onClick={() => setConsentFor(platform)}>
                      ให้ความยินยอม
                    </Button>
                  )}
                  {(live?.status === 'connected' || live?.status === 'sync_failed') && (
                    <Button variant="outline" icon={RefreshCw} onClick={() => resyncMarketplace(live.id)}>
                      ซิงก์ใหม่
                    </Button>
                  )}
                  {live && live.status !== 'syncing' && (
                    <Button variant="ghost" icon={Unplug} onClick={() => disconnect(live)}>
                      ยกเลิกการเชื่อมต่อ
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">
          เชื่อมต่อแล้ว <Badge tone="info">{mine.filter((c) => c.status === 'connected').length} แพลตฟอร์ม</Badge> — ประเมินความน่าเชื่อถือเพื่อดูผลจากข้อมูลล่าสุด
        </p>
        <LinkButton to="/m/trust" icon={ArrowRight}>
          ดูผลประเมินความน่าเชื่อถือ
        </LinkButton>
      </Card>
      <p className="text-xs text-ink-soft">
        ยกเลิกการเชื่อมต่อได้ทุกเมื่อ · ระบบสาธิตไม่เก็บรหัสผ่านหรือข้อมูลผู้ซื้อ ·{' '}
        <Link to="/m/trust" className="text-primary hover:underline">
          วิธีอ่านผลประเมิน
        </Link>
      </p>
      {consentFor && <ConsentModal open platform={consentFor} onCancel={() => setConsentFor(undefined)} onConfirm={confirmConsent} />}
    </div>
  );
}
