import { useState } from 'react';
import { RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from '@/stores';
import { useAssessmentConfigStore } from '@/stores/assessmentConfig';
import { Alert, Button, Card, CardHeader, PageHeader } from '@/components/common/ui';
import { COMPONENTS, MODEL_V2, validateWeights, type ComponentId, type Weights } from '../model';
import { ASSESSMENT_DISCLAIMER } from '../labels';

const ids = Object.keys(COMPONENTS) as ComponentId[];

/** โมเดลการประเมิน — ปรับน้ำหนักได้ และแสดงพารามิเตอร์ทั้งหมดอย่างโปร่งใส (D5) */
export default function AdminAssessmentModel() {
  const saved = useAssessmentConfigStore((s) => s.weights);
  const [draft, setDraft] = useState<Weights>(saved);
  const sum = ids.reduce((s, id) => s + (Number(draft[id]) || 0), 0);
  const error = validateWeights(draft);

  const save = () => {
    const err = useAssessmentConfigStore.getState().setWeights(draft);
    if (err) toast.error('บันทึกไม่ได้', err);
    else toast.success('บันทึกน้ำหนักแล้ว', 'มีผลกับการประเมินครั้งถัดไป');
  };
  const reset = () => {
    useAssessmentConfigStore.getState().reset();
    setDraft({ ...MODEL_V2.weights });
    toast.success('คืนค่าน้ำหนักเริ่มต้นแล้ว');
  };
  const P = MODEL_V2.penalties;
  const K = MODEL_V2.confidence;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="โมเดลการประเมิน (Trust Assessment)" subtitle={`โมเดล ${MODEL_V2.version} — ค่าทั้งหมดเป็นค่าเริ่มต้นสำหรับการจำลอง`} icon={SlidersHorizontal} />
      <Alert tone="info">การเปลี่ยนน้ำหนักมีผลกับการประเมินครั้งถัดไป ผลประเมินเดิมบันทึกน้ำหนักที่ใช้ไว้ทุกครั้ง และผลที่ใช้ข้อมูลเดิมจะแสดงว่า "ข้อมูลเปลี่ยนแปลง" ให้ประเมินใหม่</Alert>

      <Card>
        <CardHeader title="น้ำหนักองค์ประกอบ" subtitle="จำนวนเต็ม 0–100 ผลรวมต้องเท่ากับ 100" />
        <div className="space-y-3 p-4 sm:p-5">
          {ids.map((id) => (
            <label key={id} className="grid items-center gap-2 sm:grid-cols-[1fr_120px]">
              <span className="text-sm">
                <b>
                  {id} {COMPONENTS[id].label}
                </b>{' '}
                <span className="text-xs text-ink-soft">({COMPONENTS[id].source})</span>
                <span className="block text-xs text-ink-soft">{COMPONENTS[id].desc}</span>
              </span>
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  aria-label={`น้ำหนัก ${id}`}
                  value={draft[id]}
                  onChange={(e) => setDraft({ ...draft, [id]: e.target.value === '' ? 0 : Number(e.target.value) })}
                  className="h-10 w-full rounded-lg border border-line px-2 text-right"
                />
                <span className="text-sm text-ink-soft">%</span>
              </span>
            </label>
          ))}
          <p className={`text-sm font-medium ${error ? 'text-error' : 'text-success'}`} role="status">
            ผลรวม {sum}% {error ? `— ${error}` : '— ถูกต้อง'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button icon={Save} onClick={save} disabled={!!error}>
              บันทึกน้ำหนัก
            </Button>
            <Button variant="outline" icon={RotateCcw} onClick={reset}>
              คืนค่าเริ่มต้น (25/25/20/10/20)
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="วิธีคำนวณ" />
        <ol className="list-decimal space-y-1 p-4 pl-8 text-sm text-ink sm:p-5 sm:pl-10">
          <li>คำนวณคะแนน 0–100 ขององค์ประกอบที่มีข้อมูล — องค์ประกอบที่ไม่มีข้อมูล<b>ไม่ถูกนับเป็น 0</b> แต่กระจายน้ำหนักให้องค์ประกอบอื่น</li>
          <li>คะแนนตั้งต้น = Σ (คะแนนองค์ประกอบ × น้ำหนักที่ใช้ ÷ 100)</li>
          <li>หักคะแนนตามสัญญาณที่ควรตรวจสอบ: ราคาต่ำผิดปกติในสินค้าความเสี่ยงสูง/กลาง −{P.priceWatch}, รีวิวกระจุกตัว −{P.reviewBurst}, ยอดขายพุ่ง −{P.salesSpike}, ข้อร้องเรียนเร่งด่วนที่ยังไม่ปิด −{P.seriousOpenComplaint}, สัญญาณหลายข้อร่วมกัน −{P.crossSignal}</li>
          <li>
            Band: A ≥ {MODEL_V2.bands.A} (ต้องมีความเชื่อมั่นสูงและไม่มีสัญญาณที่ควรตรวจสอบ), B ≥ {MODEL_V2.bands.B}, C ≥ {MODEL_V2.bands.C}, D ต่ำกว่านั้น
          </li>
          <li>
            Insufficient Data เมื่อไม่มีการเชื่อมต่อที่ซิงก์แล้ว หรือคำสั่งซื้อ &lt; {MODEL_V2.minimums.orders}, รีวิว &lt; {MODEL_V2.minimums.reviews}, ข้อมูลการขาย &lt; {MODEL_V2.minimums.months} เดือน
          </li>
          <li>
            Data Coverage = ค่าเฉลี่ยถ่วงน้ำหนักของ: แพลตฟอร์ม (เป้า {MODEL_V2.coverage.platforms.target}), เดือน ({MODEL_V2.coverage.months.target}), รายการสินค้า ({MODEL_V2.coverage.listings.target}), คำสั่งซื้อ ({MODEL_V2.coverage.orders.target}), รีวิว ({MODEL_V2.coverage.reviews.target}), ข้อมูลในระบบ
          </li>
          <li>
            Data Confidence เริ่มที่ 100 แล้วหัก: แหล่งเดียว −{K.singleSource}, ซิงก์เกิน {K.freshFullDays} วัน −{K.stalePartial} / เกิน {K.freshPartialDays} วัน −{K.staleFull}, คำสั่งซื้อน้อย −{K.smallOrders}, รีวิวน้อย −{K.smallReviews}, คะแนนต่างกันระหว่างแพลตฟอร์ม −{K.platformGap}, รีวิวกระจุกตัว −{K.reviewBurst} → สูง ≥ {K.high}, ปานกลาง ≥ {K.medium}
          </li>
          <li>Standing (ระงับ/เพิกถอน/อยู่ระหว่างพิจารณาความเสี่ยง) แยกจาก Band และไม่ถูกคิดเป็นคะแนน — Standing ที่ไม่ปกติทำให้ใช้หรือขอ Badge ไม่ได้</li>
          <li>ผู้บริโภคเห็นเฉพาะ Band, Coverage, Confidence และคำอธิบาย — คะแนนตัวเลขเห็นเฉพาะเจ้าหน้าที่และผู้ดูแลระบบ</li>
        </ol>
      </Card>
      <p className="rounded-lg bg-bg p-3 text-xs text-ink-soft">{ASSESSMENT_DISCLAIMER}</p>
    </div>
  );
}
