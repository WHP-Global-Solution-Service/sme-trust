import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FlaskConical,
  Loader2,
  PlugZap,
  RefreshCw,
  X,
} from "lucide-react";
import type { Archetype, FailKind, MarketplaceConnection } from "../types";
import {
  ARCHETYPE_LABEL,
  CONSENT_SCOPES,
  MARKETPLACE_DISCLAIMER,
  PLATFORMS,
} from "../data/platforms";
import { generateSnapshot } from "../services/generator";
import { seedFor } from "@/stores/workflowsV2";
import { reportDemo } from "@/stores/demo";
import { Alert, Button, Card, LinkButton } from "@/components/common/ui";
import { cn } from "@/utils/cn";
import { ListingTable, SnapshotMetrics } from "./SnapshotSummary";

const STEPS = [
  "อนุญาตเข้าถึงข้อมูล",
  "เลือกร้านค้า",
  "ตรวจข้อมูลก่อนนำเข้า",
  "ผลการเชื่อมต่อ",
];

/**
 * ขั้นตอนเชื่อมต่อ Marketplace (จำลอง): ยินยอม → เลือกร้านค้าตัวอย่าง → Preview → ยืนยันนำเข้า → ผลการเชื่อมต่อ
 * สถานะเปลี่ยนเมื่อผู้ใช้กด "ยืนยันนำเข้าข้อมูล" เท่านั้น — ระหว่าง Preview ยังไม่มีการดึงข้อมูล
 * แสดงในหน้า (ไม่ใช่ Modal) เพื่อไม่บังตัวควบคุมการสาธิต
 */
export function ConnectWizard({
  connection,
  shopName,
  category,
  onClose,
  onConfirm,
  onResync,
}: {
  connection: MarketplaceConnection;
  shopName: string;
  category: string;
  onClose: () => void;
  onConfirm: (opts: { archetype: Archetype; failKind?: FailKind }) => void;
  onResync: () => void;
}) {
  const imported =
    !!connection.consentAt && connection.status !== "pending_consent";
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState(false);
  const [archetype, setArchetype] = useState<Archetype>(connection.archetype);
  const [fail, setFail] = useState<FailKind | "">("");
  const label = PLATFORMS[connection.platform].label;
  const current = imported ? 3 : step;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [current]);

  useEffect(() => {
    reportDemo("mkt.wizard", current);
  }, [current]);

  // ข้อมูลเดียวกับที่จะนำเข้าจริง (Seed เดียวกับ grantConsent)
  const preview = useMemo(
    () =>
      generateSnapshot(
        {
          id: connection.id,
          platform: connection.platform,
          archetype,
          seed: seedFor(
            connection.merchantId,
            connection.platform,
            archetype,
            connection.id,
          ),
        },
        category,
      ),
    [
      connection.id,
      connection.platform,
      connection.merchantId,
      archetype,
      category,
    ],
  );

  const footer =
    current === 0 ? (
      <>
        <Button variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button
          icon={ChevronRight}
          disabled={!agree}
          onClick={() => setStep(1)}
        >
          ถัดไป
        </Button>
      </>
    ) : current === 1 ? (
      <>
        <Button variant="outline" icon={ChevronLeft} onClick={() => setStep(0)}>
          ย้อนกลับ
        </Button>
        <Button icon={Eye} onClick={() => setStep(2)}>
          ดูตัวอย่างข้อมูล
        </Button>
      </>
    ) : current === 2 ? (
      <>
        <Button variant="outline" icon={ChevronLeft} onClick={() => setStep(1)}>
          ย้อนกลับ
        </Button>
        <Button
          icon={PlugZap}
          onClick={() => onConfirm({ archetype, failKind: fail || undefined })}
        >
          ยืนยันนำเข้าข้อมูล
        </Button>
      </>
    ) : connection.status === "connected" ? (
      <>
        <Button variant="outline" onClick={onClose}>
          ปิด
        </Button>
        <LinkButton
          variant="outline"
          to={`/m/marketplace/data/${connection.id}`}
        >
          ดูภาพรวมข้อมูล
        </LinkButton>
        {/* Scenario 9: นำข้อมูลที่นำเข้าไปเติมโปรไฟล์ร้านเดิม (ตรวจ/แก้ไข แล้วยืนยันเอง) */}
        <LinkButton
          to={`/m/marketplace/profile/${connection.id}`}
          icon={ChevronRight}
        >
          เติมข้อมูลโปรไฟล์ร้านอัตโนมัติ
        </LinkButton>
      </>
    ) : connection.status === "sync_failed" ? (
      <>
        <Button variant="outline" onClick={onClose}>
          ปิด
        </Button>
        <Button icon={RefreshCw} onClick={onResync}>
          ลองซิงก์ใหม่
        </Button>
      </>
    ) : (
      <Button variant="outline" onClick={onClose}>
        ปิด (ซิงก์ต่อเบื้องหลัง)
      </Button>
    );

  return (
    <Card className="scroll-mt-24 border-primary/40 ring-2 ring-primary/10">
      <section ref={ref} aria-label={`เชื่อมต่อ ${label}`}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-semibold text-ink">เชื่อมต่อ {label}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-bg"
            aria-label="ปิดขั้นตอนการเชื่อมต่อ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <ol
            className="grid grid-cols-4 gap-1"
            aria-label="ขั้นตอนการเชื่อมต่อ"
          >
            {STEPS.map((s, i) => (
              <li key={s} className="min-w-0">
                <span
                  className={cn(
                    "block h-1.5 rounded-full",
                    i <= current ? "bg-primary" : "bg-line",
                  )}
                />
                <span
                  className={cn(
                    "mt-1 block truncate text-[11px]",
                    i === current
                      ? "font-semibold text-primary"
                      : "text-ink-soft",
                  )}
                >
                  {i + 1}. {s}
                </span>
              </li>
            ))}
          </ol>

          {current === 0 && (
            <>
              <p className="text-ink">
                SME Trust (ระบบสาธิต) ขอเข้าถึงข้อมูลต่อไปนี้จาก <b>{label}</b>{" "}
                เพื่อใช้ประกอบการประเมินความน่าเชื่อถือของร้าน <b>{shopName}</b>
              </p>
              <p className="rounded-lg bg-primary-50 p-2.5 text-xs text-ink" data-testid="match-existing">
                เชื่อมเป็นช่องทางขายเพิ่มของร้าน <b>{shopName}</b> ที่มีอยู่แล้ว — ไม่สร้างบัญชีหรือร้านใหม่ · ระบบปรับความครอบคลุมของข้อมูลและประเมินใหม่อัตโนมัติหลังนำเข้า
              </p>
              <ul className="space-y-1.5">
                {CONSENT_SCOPES.map((s) => (
                  <li key={s} className="flex gap-2 text-ink">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {s}
                  </li>
                ))}
              </ul>
              <p className="rounded-lg bg-bg p-2.5 text-xs text-ink-soft">
                ไม่ขอรหัสผ่าน ไม่ขอข้อมูลผู้ซื้อ
                และยกเลิกการเชื่อมต่อได้ทุกเมื่อ — {MARKETPLACE_DISCLAIMER}
              </p>
              <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-ink">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                ข้าพเจ้ายินยอมให้ SME Trust (จำลอง)
                เข้าถึงข้อมูลตามขอบเขตข้างต้น
              </label>
            </>
          )}

          {current === 1 && (
            <>
              <p className="text-ink">
                เลือกร้านบน {label} ที่จะเชื่อมต่อ —
                ร้านตัวอย่างแต่ละร้านมีลักษณะข้อมูลต่างกัน
                เพื่อสาธิตผลการวิเคราะห์ที่ต่างกัน
              </p>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="ร้านค้าตัวอย่าง"
              >
                {(Object.keys(ARCHETYPE_LABEL) as Archetype[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={archetype === a}
                    onClick={() => setArchetype(a)}
                    className={cn(
                      "rounded-xl border p-3 text-left",
                      archetype === a
                        ? "border-primary bg-primary-50"
                        : "border-line hover:bg-bg",
                    )}
                  >
                    <span className="block font-medium text-ink">
                      {ARCHETYPE_LABEL[a].label}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {ARCHETYPE_LABEL[a].desc}
                    </span>
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-secondary">
                <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                ร้านตัวอย่างใช้ชื่อร้านของคุณ (Shop ID จำลอง{" "}
                {connection.mockShopId}) — ข้อมูลการขายสร้างขึ้นเพื่อการสาธิต
              </p>
            </>
          )}

          {current === 2 && (
            <>
              <p className="text-ink">
                ข้อมูลที่จะนำเข้าจาก <b>{label}</b> — ร้าน{" "}
                <b>{connection.mockShopName}</b> · Shop ID จำลอง{" "}
                <span className="font-mono">{connection.mockShopId}</span>
              </p>
              <SnapshotMetrics snap={preview} category={category} />
              <ListingTable snap={preview} />
              <p className="text-xs text-ink-soft">
                ระบบยังไม่ดึงข้อมูลจนกว่าจะกด "ยืนยันนำเข้าข้อมูล"
              </p>
              <fieldset className="rounded-xl border border-dashed border-secondary/40 bg-secondary-50/50 p-3 text-xs text-ink">
                <legend className="px-1 font-semibold text-secondary">
                  สำหรับการสาธิต: ผลการเชื่อมต่อ
                </legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(
                    [
                      ["", "สำเร็จ (ค่าปกติ)"],
                      ["connect", "จำลอง: เชื่อมต่อไม่สำเร็จ"],
                      ["import", "จำลอง: นำเข้าข้อมูลไม่สำเร็จ"],
                      ["sync", "จำลอง: ซิงก์ไม่สำเร็จ"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k || "ok"} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="sim-result"
                        checked={fail === k}
                        onChange={() => setFail(k)}
                        className="h-4 w-4 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {current === 3 && (
            <div className="space-y-3" role="status">
              {connection.status === "syncing" && (
                <p className="flex items-center gap-2 rounded-xl bg-info-50 p-3 text-info">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังซิงก์ข้อมูลจำลอง…
                </p>
              )}
              {connection.status === "connected" && (
                <Alert
                  tone="success"
                  title="เชื่อมต่อสำเร็จ (Connection Success)"
                >
                  นำเข้าข้อมูลร้าน {connection.mockShopName} เรียบร้อย — Shop ID
                  จำลอง {connection.mockShopId}
                </Alert>
              )}
              {connection.status === "sync_failed" && (
                <Alert
                  tone="error"
                  title={
                    connection.failKind === "connect"
                      ? "เชื่อมต่อไม่สำเร็จ (Connection Failed)"
                      : connection.failKind === "import"
                        ? "นำเข้าข้อมูลไม่สำเร็จ (Import Failed)"
                        : "ซิงก์ไม่สำเร็จ (Sync Failed)"
                  }
                >
                  {connection.failReason}
                </Alert>
              )}
              <p className="text-xs text-ink-soft">{MARKETPLACE_DISCLAIMER}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
          {footer}
        </div>
      </section>
    </Card>
  );
}
