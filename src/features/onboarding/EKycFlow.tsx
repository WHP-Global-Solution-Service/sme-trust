import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Lightbulb, RotateCcw, ScanFace, ShieldCheck, Sun, XCircle } from 'lucide-react';
import { Alert, Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { reportDemo } from '@/stores/demo';

type Phase = 'intro' | 'card' | 'card_scan' | 'face' | 'face_scan' | 'success' | 'failed';

/**
 * Mock e-KYC — ไม่เข้าถึงกล้อง ไม่เก็บภาพใบหน้า และไม่เก็บเลขบัตรประชาชน
 * ใช้กราฟิกและ Animation จำลองขั้นตอนเท่านั้น
 */
export function EKycFlow({ onDone, onSkip }: { onDone: (ok: boolean) => void; onSkip?: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  useEffect(() => reportDemo('ekyc.phase', phase), [phase]);
  const [simulateFail, setSimulateFail] = useState(false);
  const [failAt, setFailAt] = useState<'card' | 'face'>('face');

  useEffect(() => {
    if (phase === 'card_scan') {
      const t = setTimeout(() => setPhase(simulateFail && failAt === 'card' ? 'failed' : 'face'), 2200);
      return () => clearTimeout(t);
    }
    if (phase === 'face_scan') {
      const t = setTimeout(() => setPhase(simulateFail ? 'failed' : 'success'), 2400);
      return () => clearTimeout(t);
    }
  }, [phase, simulateFail, failAt]);

  if (phase === 'intro')
    return (
      <div className="space-y-4">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-primary-50 text-primary">
          <ShieldCheck className="h-10 w-10" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-ink">ยืนยันตัวตน (จำลอง)</h2>
          <p className="text-sm text-ink-soft">ใช้เวลาประมาณ 1 นาที ประกอบด้วยการถ่ายบัตรและสแกนใบหน้าแบบจำลอง</p>
        </div>
        <ul className="space-y-2 rounded-xl bg-bg p-4 text-sm">
          <li className="flex gap-2"><CreditCard className="h-5 w-5 shrink-0 text-primary" />เตรียมบัตรประจำตัวให้พร้อม (ในระบบสาธิตไม่ต้องใช้บัตรจริง)</li>
          <li className="flex gap-2"><Sun className="h-5 w-5 shrink-0 text-primary" />อยู่ในที่มีแสงสว่างเพียงพอ ไม่สวมหมวกหรือแว่นกันแดด</li>
          <li className="flex gap-2"><Lightbulb className="h-5 w-5 shrink-0 text-primary" />ระบบนี้ไม่เปิดกล้อง ไม่เก็บภาพ และไม่เก็บเลขบัตรประชาชน</li>
        </ul>
        <div className="rounded-xl border border-dashed border-line p-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={simulateFail} onChange={(e) => setSimulateFail(e.target.checked)} className="h-5 w-5 accent-primary" />
            จำลองการตรวจสอบไม่ผ่าน (เพื่อสาธิตการลองใหม่)
          </label>
          {simulateFail && (
            <div className="mt-2 flex gap-3 pl-6 text-sm">
              {(['card', 'face'] as const).map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input type="radio" checked={failAt === f} onChange={() => setFailAt(f)} className="accent-primary" />
                  {f === 'card' ? 'ล้มเหลวที่ขั้นบัตร' : 'ล้มเหลวที่ขั้นใบหน้า'}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button block size="lg" onClick={() => setPhase('card')}>
          เริ่มยืนยันตัวตน
        </Button>
        {onSkip && (
          <Button block variant="ghost" onClick={onSkip}>
            ข้ามไปก่อน (ยืนยันภายหลังได้ที่หน้าหลัก)
          </Button>
        )}
      </div>
    );

  if (phase === 'card' || phase === 'card_scan')
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-bold text-ink">ถ่ายภาพบัตรประจำตัว (จำลอง)</h2>
        <p className="text-sm text-ink-soft">วางบัตรให้อยู่ในกรอบ</p>
        <div className="relative mx-auto aspect-[1.586] w-full max-w-xs overflow-hidden rounded-2xl bg-ink p-4">
          <div className="absolute inset-3 rounded-xl border-2 border-dashed border-white/70" />
          {/* บัตรจำลอง */}
          <div className="relative mx-auto mt-3 flex h-[70%] w-[86%] gap-2 rounded-lg bg-gradient-to-br from-sky-100 to-white p-2.5 text-left">
            <div className="flex-1 space-y-1.5">
              <div className="h-2 w-3/4 rounded bg-primary/40" />
              <div className="h-1.5 w-1/2 rounded bg-slate-300" />
              <div className="h-1.5 w-2/3 rounded bg-slate-300" />
              <div className="h-1.5 w-1/3 rounded bg-slate-300" />
              <p className="pt-1 text-[8px] font-semibold text-primary">DEMO ID — ไม่ใช่บัตรจริง</p>
            </div>
            <div className="h-full w-1/4 rounded bg-slate-300" />
          </div>
          {phase === 'card_scan' && <div className="absolute inset-x-3 h-0.5 animate-scan bg-sky-300 shadow-[0_0_12px_3px_rgba(125,211,252,.8)]" />}
        </div>
        {phase === 'card' ? (
          <Button block size="lg" icon={CreditCard} onClick={() => setPhase('card_scan')}>
            จำลองการถ่ายบัตร
          </Button>
        ) : (
          <p className="text-sm font-medium text-primary">กำลังตรวจสอบข้อมูลบนบัตร...</p>
        )}
      </div>
    );

  if (phase === 'face' || phase === 'face_scan')
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-bold text-ink">สแกนใบหน้า (จำลอง)</h2>
        <p className="text-sm text-ink-soft">{phase === 'face' ? 'มองตรงไปที่กรอบ แล้วกดปุ่มด้านล่าง' : 'กรุณากะพริบตาช้า ๆ'}</p>
        <div className="relative mx-auto grid h-56 w-56 place-items-center">
          {phase === 'face_scan' && <span className="absolute inset-0 animate-pulseRing rounded-full border-4 border-primary" />}
          <div className={cn('grid h-48 w-48 place-items-center overflow-hidden rounded-full border-4', phase === 'face_scan' ? 'border-primary' : 'border-dashed border-ink-soft')}>
            <svg viewBox="0 0 100 100" className="h-40 w-40 text-slate-300">
              <circle cx="50" cy="38" r="18" fill="currentColor" />
              <path d="M18 92c4-18 18-28 32-28s28 10 32 28" fill="currentColor" />
            </svg>
          </div>
        </div>
        {phase === 'face' ? (
          <Button block size="lg" icon={ScanFace} onClick={() => setPhase('face_scan')}>
            จำลองการสแกนใบหน้า
          </Button>
        ) : (
          <p className="text-sm font-medium text-primary">กำลังเปรียบเทียบใบหน้ากับข้อมูลบัตร (จำลอง)...</p>
        )}
      </div>
    );

  if (phase === 'success')
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
        <div>
          <h2 className="text-lg font-bold text-ink">Identity Verified</h2>
          <p className="text-sm text-ink-soft">ยืนยันตัวตนจำลองสำเร็จ คุณได้รับสถานะ Level 1</p>
        </div>
        <Alert tone="info">Identity Verified หมายถึงยืนยันตัวตนเจ้าของบัญชีเท่านั้น ไม่ใช่การรับรองคุณภาพสินค้าหรือธุรกิจ</Alert>
        <Button block size="lg" onClick={() => onDone(true)}>
          ดำเนินการต่อ
        </Button>
      </div>
    );

  return (
    <div className="space-y-4 text-center">
      <XCircle className="mx-auto h-20 w-20 text-error" />
      <div>
        <h2 className="text-lg font-bold text-ink">Verification Failed</h2>
        <p className="text-sm text-ink-soft">{failAt === 'card' ? 'ภาพบัตรไม่ชัดเจนหรือมีแสงสะท้อน' : 'ไม่สามารถยืนยันใบหน้าได้ กรุณาอยู่ในที่มีแสงสว่าง'}</p>
      </div>
      <Button
        block
        size="lg"
        icon={RotateCcw}
        onClick={() => {
          setSimulateFail(false);
          setPhase('card');
        }}
      >
        ลองใหม่อีกครั้ง (Retry)
      </Button>
      <Button block variant="ghost" onClick={() => onDone(false)}>
        ทำภายหลัง
      </Button>
    </div>
  );
}
