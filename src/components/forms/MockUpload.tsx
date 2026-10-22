import { useRef } from 'react';
import { FileText, Paperclip, Plus, Trash2 } from 'lucide-react';
import type { MockDocument } from '@/types';
import { nowISO, uid } from '@/utils/id';

/**
 * การอัปโหลดไฟล์แบบจำลอง — อ่านเฉพาะชื่อและขนาดไฟล์บน Browser
 * ไม่อ่านเนื้อหาไฟล์ และไม่ส่งไฟล์ไปยัง Server ใด ๆ
 */
export function MockUpload({ value, onChange, kinds, max = 5 }: { value: MockDocument[]; onChange: (v: MockDocument[]) => void; kinds?: string[]; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const kindList = kinds ?? ['เอกสารประกอบ'];

  const addSample = (kind: string) => {
    if (value.length >= max) return;
    onChange([...value, { id: uid('doc'), name: `${kind} (ตัวอย่างจำลอง).pdf`, kind, sizeKb: 180 + Math.round(Math.random() * 600), addedAt: nowISO() }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {kindList.map((k) => (
          <button key={k} type="button" onClick={() => addSample(k)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary-50/50 px-3 text-sm text-primary hover:bg-primary-50">
            <Plus className="h-4 w-4" />
            {k}
          </button>
        ))}
        <button type="button" onClick={() => ref.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm text-ink hover:bg-bg">
          <Paperclip className="h-4 w-4" />
          เลือกไฟล์จากเครื่อง (จำลอง)
        </button>
        <input
          ref={ref}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, max - value.length);
            onChange([...value, ...files.map((f) => ({ id: uid('doc'), name: f.name, kind: kindList[0], sizeKb: Math.max(1, Math.round(f.size / 1024)), addedAt: nowISO() }))]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-xs text-ink-soft">ระบบสาธิตเก็บเฉพาะชื่อไฟล์ไว้ในเบราว์เซอร์ ไม่อัปโหลดไฟล์ไปที่ใด กรุณาอย่าใช้เอกสารจริง</p>
      {value.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {value.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{d.name}</p>
                <p className="text-xs text-ink-soft">
                  {d.kind} · {d.sizeKb} KB
                </p>
              </div>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== d.id))} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-50 hover:text-error" aria-label="ลบไฟล์">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocList({ docs }: { docs: MockDocument[] }) {
  if (!docs.length) return <p className="text-sm text-ink-soft">ไม่มีเอกสารแนบ</p>;
  return (
    <ul className="space-y-1.5">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{d.name}</span>
          <span className="shrink-0 text-xs text-ink-soft">{d.sizeKb} KB</span>
        </li>
      ))}
    </ul>
  );
}
