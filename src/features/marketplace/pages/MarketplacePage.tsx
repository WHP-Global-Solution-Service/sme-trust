import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Database, Link2, Loader2, PlugZap, RefreshCw, Store, Unplug } from 'lucide-react';
import { confirmDialog, toast, useMarketplaceStore } from '@/stores';
import { reportDemo } from '@/stores/demo';
import { useMyMerchants } from '@/hooks/useCurrent';
import { completeSync, connectMarketplace, disconnectMarketplace, grantConsent, resyncMarketplace } from '@/stores/workflowsV2';
import { Alert, Badge, Button, Card, CardHeader, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { fmtDate } from '@/utils/format';
import type { Archetype, FailKind, MarketplaceConnection, Platform } from '../types';
import { ARCHETYPE_LABEL, PLATFORM_LIST, PLATFORMS } from '../data/platforms';
import { snapshotOf } from '../services/generator';
import { CONNECTION_STATUS, MarketplaceDisclaimer } from '../components/MarketplaceParts';
import { ConnectWizard } from '../components/ConnectWizard';
import { snapshotStats } from '../components/SnapshotSummary';

/** เวลาจำลองการซิงก์ (แสดงสถานะกำลังซิงก์ ไม่ใช่การเปลี่ยนหน้าอัตโนมัติ) */
const SYNC_MS = 1200;

/** ทางเลือกสำหรับร้านที่ไม่มีบัญชี Marketplace — ไม่เสียคะแนน (Missing Data ≠ 0) */
function NoMarketplace({ hasShop }: { hasShop: boolean }) {
  const nav = useNavigate();
  return (
    <Card className="p-4 sm:p-5">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Store className="h-5 w-5 text-primary" />
        ไม่มีร้านบน Shopee หรือ Lazada?
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        ร้านที่ขายผ่าน Facebook, LINE, หน้าร้าน หรือช่องทางอื่นเข้าร่วม SME Trust ได้เหมือนกัน — ระบบประเมินจากข้อมูลที่มี และ<b>ไม่หักคะแนน</b>เพราะไม่มีบัญชี Marketplace (ผลอาจเป็น Insufficient Data ซึ่งไม่ใช่ผลลบ)
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {hasShop ? (
          <LinkButton to="/m/trust" variant="outline" icon={ArrowRight}>
            ดูผลประเมินจากข้อมูลในระบบ
          </LinkButton>
        ) : (
          <Button
            icon={ArrowRight}
            onClick={() => {
              reportDemo('mkt.none', true);
              nav('/m/register-shop');
            }}
          >
            ไม่มีร้านบน Marketplace — ลงทะเบียนด้วยตนเอง
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function MarketplacePage() {
  const { active: m } = useMyMerchants();
  const all = useMarketplaceStore((s) => s.items);
  const [wizardFor, setWizardFor] = useState<string>();
  // จำลองการซิงก์ไม่สำเร็จ (ตั้งจากหน้า Preview) — เก็บตามรหัสการเชื่อมต่อ
  const failSim = useRef<Record<string, FailKind | undefined>>({});

  const mine = all.filter((c) => c.merchantId === m?.id);
  const syncing = mine.filter((c) => c.status === 'syncing').map((c) => c.id).join(',');

  // ทำให้การซิงก์ที่ค้างอยู่เสร็จ (รวมกรณีออกจากหน้าแล้วกลับมา)
  useEffect(() => {
    if (!syncing) return;
    const ids = syncing.split(',');
    const t = setTimeout(() => {
      ids.forEach((id) => {
        const kind = failSim.current[id];
        const ok = !kind;
        completeSync(id, ok, kind);
        delete failSim.current[id];
        const c = useMarketplaceStore.getState().items.find((x) => x.id === id);
        if (c) (ok ? toast.success : toast.error)(ok ? `ซิงก์ ${PLATFORMS[c.platform].label} สำเร็จ` : `ซิงก์ ${PLATFORMS[c.platform].label} ไม่สำเร็จ`, ok ? 'ประเมินความน่าเชื่อถือใหม่เพื่อใช้ข้อมูลล่าสุด' : 'กด "ซิงก์ใหม่" เพื่อลองอีกครั้ง');
      });
    }, SYNC_MS);
    return () => clearTimeout(t);
  }, [syncing]);

  if (!m)
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader title="เชื่อมต่อ Marketplace (จำลอง)" back={{ to: '/m', label: 'หน้าหลัก' }} />
        <Alert tone="info" title="ยังไม่มีร้านค้าในระบบ">
          ลงทะเบียนร้านค้าก่อน แล้วจึงเชื่อมต่อข้อมูล Marketplace (จำลอง) ได้ในภายหลัง
        </Alert>
        <NoMarketplace hasShop={false} />
        <MarketplaceDisclaimer />
      </div>
    );

  const wizardConn = mine.find((c) => c.id === wizardFor);

  const start = (platform: Platform) => {
    const c = connectMarketplace(m.id, platform);
    setWizardFor(c.id);
  };

  const confirmImport = ({ archetype, failKind }: { archetype: Archetype; failKind?: FailKind }) => {
    if (!wizardConn) return;
    failSim.current[wizardConn.id] = failKind;
    grantConsent(wizardConn.id, archetype);
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

  const connectedCount = mine.filter((c) => c.status === 'connected').length;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="เชื่อมต่อ Marketplace (จำลอง)" subtitle={`${m.shopName} — ใช้ข้อมูลการขายประกอบการประเมินความน่าเชื่อถือ`} icon={Link2} back={{ to: '/m', label: 'หน้าหลัก' }} />
      <MarketplaceDisclaimer />
      {wizardConn && (
        <ConnectWizard
          key={wizardConn.id}
          connection={wizardConn}
          shopName={m.shopName}
          category={m.category}
          onClose={() => setWizardFor(undefined)}
          onConfirm={confirmImport}
          onResync={() => resyncMarketplace(wizardConn.id)}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORM_LIST.map((platform) => {
          const c = mine.filter((x) => x.platform === platform).sort((a, b) => (a.status === 'disconnected' ? 1 : 0) - (b.status === 'disconnected' ? 1 : 0) || b.createdAt.localeCompare(a.createdAt))[0];
          const live = c && c.status !== 'disconnected' ? c : undefined;
          const snap = live?.status === 'connected' && live.lastSyncAt ? snapshotOf(live, m.category) : undefined;
          const st = snap && snapshotStats(snap);
          return (
            <Card key={platform} data-platform={platform}>
              <CardHeader title={PLATFORMS[platform].label} subtitle={live ? `Shop ID จำลอง ${live.mockShopId}` : 'ยังไม่ได้เชื่อมต่อ'} action={live ? <StatusBadge map={CONNECTION_STATUS} value={live.status} /> : undefined} />
              <div className="space-y-3 p-4 text-sm">
                {live?.status === 'syncing' && (
                  <p className="flex items-center gap-2 text-info">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังซิงก์ข้อมูลจำลอง…
                  </p>
                )}
                {live?.status === 'sync_failed' && <p className="text-error">{live.failReason}</p>}
                {live && live.status !== 'pending_consent' && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-soft">ลักษณะข้อมูลจำลอง</dt>
                    <dd className="text-ink">{ARCHETYPE_LABEL[live.archetype].label}</dd>
                    <dt className="text-ink-soft">ให้ความยินยอมเมื่อ</dt>
                    <dd className="text-ink">{live.consentAt ? fmtDate(live.consentAt, true) : '—'}</dd>
                    <dt className="text-ink-soft">ซิงก์ล่าสุด</dt>
                    <dd className="text-ink">{live.lastSyncAt ? fmtDate(live.lastSyncAt, true) : '—'}</dd>
                  </dl>
                )}
                {st && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-bg p-2">
                      <p className="text-xs text-ink-soft">คำสั่งซื้อ 12 เดือน</p>
                      <p className="font-semibold">{st.orders.toLocaleString('th-TH')}</p>
                    </div>
                    <div className="rounded-lg bg-bg p-2">
                      <p className="text-xs text-ink-soft">คะแนนร้าน</p>
                      <p className="font-semibold">{st.reviews ? st.rating.toFixed(2) : '—'}</p>
                    </div>
                    <div className="rounded-lg bg-bg p-2">
                      <p className="text-xs text-ink-soft">รีวิว</p>
                      <p className="font-semibold">{st.reviews.toLocaleString('th-TH')}</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {!live && (
                    <Button icon={PlugZap} onClick={() => start(platform)}>
                      เชื่อมต่อ {PLATFORMS[platform].label}
                    </Button>
                  )}
                  {live?.status === 'pending_consent' && (
                    <Button icon={PlugZap} onClick={() => setWizardFor(live.id)}>
                      ให้ความยินยอม
                    </Button>
                  )}
                  {live?.status === 'connected' && (
                    <LinkButton to={`/m/marketplace/data/${live.id}`} icon={Database}>
                      ดูภาพรวมข้อมูล
                    </LinkButton>
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
          เชื่อมต่อแล้ว <Badge tone="info">{connectedCount} แพลตฟอร์ม</Badge> — วิเคราะห์ข้อมูลหรือประเมินความน่าเชื่อถือจากข้อมูลล่าสุด
        </p>
        <div className="flex flex-wrap gap-2">
          {connectedCount > 0 && (
            <LinkButton to="/m/marketplace/analysis" variant="outline" icon={BarChart3}>
              วิเคราะห์ข้อมูลการขาย
            </LinkButton>
          )}
          <LinkButton to="/m/trust" icon={ArrowRight}>
            ผลประเมินความน่าเชื่อถือ
          </LinkButton>
        </div>
      </Card>
      <NoMarketplace hasShop />
      <p className="text-xs text-ink-soft">
        ยกเลิกการเชื่อมต่อได้ทุกเมื่อ · ระบบสาธิตไม่เก็บรหัสผ่านหรือข้อมูลผู้ซื้อ ·{' '}
        <Link to="/m/trust" className="text-primary hover:underline">
          วิธีอ่านผลประเมิน
        </Link>
      </p>
    </div>
  );
}
