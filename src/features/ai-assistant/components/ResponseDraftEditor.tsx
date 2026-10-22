import { Copy, CornerDownRight, MessageSquareText, RefreshCw, RotateCcw } from 'lucide-react';
import type { DraftTone, Particle } from '../types/ai.types';
import { TONE_LABEL } from '../services/responseDraftGenerator';
import { Badge, Button } from '@/components/common/ui';
import { cn } from '@/utils/cn';
import { copyWithToast, SectionCard } from './AiCommon';

export function ResponseDraftEditor({
  tone,
  particle,
  draft,
  edited,
  onTone,
  onParticle,
  onChange,
  onRegenerate,
  onReset,
  onInsert,
  insertDisabledReason,
}: {
  tone: DraftTone;
  particle: Particle;
  draft: string;
  edited: boolean;
  onTone: (t: DraftTone) => void;
  onParticle: (p: Particle) => void;
  onChange: (v: string) => void;
  onRegenerate: () => void;
  onReset: () => void;
  onInsert?: () => void;
  insertDisabledReason?: string;
}) {
  return (
    <SectionCard title="ร่างคำตอบถึงลูกค้า (Response Draft)" icon={MessageSquareText} action={edited ? <Badge tone="info">แก้ไขแล้ว</Badge> : undefined}>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">น้ำเสียง (Tone)</legend>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {(Object.keys(TONE_LABEL) as DraftTone[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tone === t}
              onClick={() => onTone(t)}
              className={cn('min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm', tone === t ? 'border-primary bg-primary-50 font-medium text-primary' : 'border-line bg-white text-ink hover:border-primary/40')}
            >
              {TONE_LABEL[t]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        คำลงท้าย
        <select value={particle} onChange={(e) => onParticle(e.target.value as Particle)} className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
          <option value="ค่ะ/ครับ">ค่ะ/ครับ</option>
          <option value="ค่ะ">ค่ะ</option>
          <option value="ครับ">ครับ</option>
        </select>
      </label>
      <label htmlFor="draft-editor" className="mb-1.5 mt-3 block text-sm font-medium text-ink">
        ร่างคำตอบ (แก้ไขได้)
      </label>
      <textarea
        id="draft-editor"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        rows={9}
        className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <p className="mt-1 text-xs text-ink-soft">ร่างนี้ไม่ยืนยันว่าร้านได้คืนเงินหรือจัดส่งแล้ว กรุณาตรวจสอบข้อเท็จจริงและแก้ไขก่อนใช้งาน — ระบบไม่ส่งข้อความถึงลูกค้าโดยอัตโนมัติ</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" icon={Copy} disabled={!draft.trim()} onClick={() => copyWithToast(draft, 'ร่างคำตอบ')}>
          คัดลอก
        </Button>
        <Button variant="outline" icon={RefreshCw} onClick={onRegenerate}>
          สร้างสำนวนใหม่
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={onReset}>
          รีเซ็ตร่าง
        </Button>
      </div>
      {onInsert && (
        <div className="mt-3 border-t border-line pt-3">
          <Button block size="lg" icon={CornerDownRight} disabled={!!insertDisabledReason || !draft.trim()} onClick={onInsert}>
            นำร่างไปใส่ช่องตอบกลับเคส
          </Button>
          <p className="mt-1 text-center text-xs text-ink-soft">{insertDisabledReason ?? 'ระบบจะเปิดหน้าตอบกลับเคสพร้อมร่างนี้ — ยังไม่ส่ง จนกว่าคุณจะตรวจสอบและกดส่งเอง'}</p>
        </div>
      )}
    </SectionCard>
  );
}
