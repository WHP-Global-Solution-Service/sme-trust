import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Send, Sparkles, X } from 'lucide-react';
import type { MockDocument, OfferType } from '@/types';
import { useComplaintStore, toast } from '@/stores';
import { merchantRespond } from '@/stores/workflows';
import { useMyMerchants } from '@/hooks/useCurrent';
import { consumers } from '@/mock/data';
import { COMPLAINT_STATUS, OFFER_TYPE } from '@/constants/labels';
import { maskName } from '@/utils/format';
import { Alert, Button, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from '@/components/common/ui';
import { useAiWorkspaceStore } from '@/stores/aiWorkspace';
import { AiSimulationBadge } from '@/features/ai-assistant/components/AiCommon';
import { Timeline } from '@/components/common/Timeline';
import { Field, Input, Select, Textarea } from '@/components/forms/Field';
import { MockUpload } from '@/components/forms/MockUpload';
import NotFoundPage from '@/features/onboarding/NotFoundPage';
import { CaseInfo, CaseProgress, CaseThread, OfferList } from './CaseParts';

const TEMPLATES: Record<OfferType, string> = {
  refund: 'ร้านขออภัยในความไม่สะดวก ยินดีคืนเงินเต็มจำนวนภายใน 3 วันทำการ',
  replace: 'ร้านขออภัย จะจัดส่งสินค้าใหม่ที่ถูกต้องให้ภายใน 2 วัน และรับผิดชอบค่าส่งคืนสินค้าเดิม',
  reship: 'ร้านจะจัดส่งสินค้าใหม่พร้อมแจ้งเลขพัสดุภายใน 24 ชั่วโมง',
  explain: 'ร้านขอชี้แจงข้อเท็จจริงดังนี้ ...',
  request_info: 'รบกวนส่งภาพสินค้าที่ได้รับและภาพหน้ากล่องพัสดุเพิ่มเติม เพื่อให้ร้านตรวจสอบได้รวดเร็ว',
};

export default function MerchantComplaintDetail() {
  const { id } = useParams();
  const { mine } = useMyMerchants();
  const c = useComplaintStore((s) => s.items.find((x) => x.id === id));
  // ร่างจาก AI Simulation ที่ร้านค้ากด "นำไปใส่ช่องตอบกลับ" — ยังไม่ถูกส่งจนกว่าจะกดส่งเอง
  const replyDraft = useAiWorkspaceStore((s) => (id ? s.replyDrafts[id] : undefined));
  const setReplyDraft = useAiWorkspaceStore((s) => s.setReplyDraft);
  const [type, setType] = useState<OfferType>(replyDraft?.suggestedType ?? 'refund');
  const [amount, setAmount] = useState<number>(c?.orderAmount ?? 0);
  const [note, setNote] = useState(replyDraft?.text ?? TEMPLATES.refund);
  const [fromAi, setFromAi] = useState(!!replyDraft);
  const [att, setAtt] = useState<MockDocument[]>([]);
  const [err, setErr] = useState('');
  const loadedDraft = useRef(replyDraft?.createdAt);
  useEffect(() => {
    if (!replyDraft || loadedDraft.current === replyDraft.createdAt) return;
    loadedDraft.current = replyDraft.createdAt;
    setNote(replyDraft.text);
    setType(replyDraft.suggestedType);
    setFromAi(true);
  }, [replyDraft]);

  if (!c) return <NotFoundPage />;
  const shop = mine.find((m) => m.id === c.merchantId);
  if (!shop)
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState icon={Lock} title="ไม่มีสิทธิ์ดูเรื่องนี้" desc="ข้อร้องเรียนนี้ไม่ใช่ของร้านค้าในบัญชีปัจจุบัน (การจำกัดสิทธิ์ระดับ UI จำลอง)" />
      </Card>
    );

  const consumer = consumers.find((x) => x.id === c.consumerId);
  const canRespond = !['resolved', 'closed'].includes(c.status);
  const hasPending = c.offers.some((o) => o.status === 'pending');

  const submit = () => {
    if (note.trim().length < 10) return setErr('กรุณาเขียนข้อความอย่างน้อย 10 ตัวอักษร');
    if (type === 'refund' && (!amount || amount <= 0)) return setErr('กรุณาระบุจำนวนเงินที่เสนอคืน');
    if (type === 'refund' && amount > c.orderAmount * 2) return setErr('จำนวนเงินสูงผิดปกติ กรุณาตรวจสอบ');
    setErr('');
    merchantRespond(c.id, { type, amount: type === 'refund' ? amount : undefined, note: note.trim(), attachment: att[0] });
    setAtt([]);
    setReplyDraft(c.id, undefined);
    setFromAi(false);
    toast.success('ส่งการตอบกลับแล้ว', OFFER_TYPE[type]);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={c.title}
        subtitle={`${c.id} · ${shop.shopName}`}
        back={{ to: '/m/complaints', label: 'ข้อร้องเรียน' }}
        action={
          <>
            <StatusBadge map={COMPLAINT_STATUS} value={c.status} />
            <LinkButton to={`/m/ai/complaint?case=${c.id}`} size="sm" variant="secondary" icon={Sparkles}>
              ให้ AI ช่วยวิเคราะห์
            </LinkButton>
          </>
        }
      />
      <Card className="mb-4 p-4">
        <CaseProgress status={c.status} />
      </Card>
      {c.status === 'escalated' && (
        <Alert tone="warning" className="mb-4" title="เรื่องนี้ถูกส่งต่อเจ้าหน้าที่แล้ว">
          {c.escalationReason} — ร้านค้ายังสามารถส่งคำชี้แจงเพิ่มเติมเพื่อประกอบการพิจารณาได้
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="รายละเอียดข้อร้องเรียน" subtitle="ข้อมูลผู้ร้องเรียนแสดงเท่าที่จำเป็น" />
            <div className="px-4 sm:px-5">
              <CaseInfo c={c} consumerName={consumer ? maskName(consumer.name) : undefined} />
            </div>
          </Card>
          <Card>
            <CardHeader title="การสนทนา" />
            <div className="p-4 sm:p-5">
              <CaseThread c={c} viewer="merchant" />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          {canRespond && (
            <Card className="border-primary/30">
              <CardHeader
                title="ตอบกลับ / เสนอแนวทางแก้ไข"
                action={
                  !fromAi && (
                    <LinkButton to={`/m/ai/complaint?case=${c.id}`} size="sm" variant="ghost" icon={Sparkles}>
                      ร่างด้วย AI
                    </LinkButton>
                  )
                }
              />
              <div className="space-y-3 p-4 sm:p-5">
                {hasPending && <Alert tone="info">มีข้อเสนอที่รอผู้บริโภคตอบอยู่ ข้อเสนอใหม่จะถูกเพิ่มเป็นทางเลือก</Alert>}
                {fromAi && (
                  <div className="rounded-xl border border-secondary/30 bg-secondary-50 p-3 text-sm" role="status">
                    <div className="flex items-center justify-between gap-2">
                      <AiSimulationBadge />
                      <button
                        onClick={() => {
                          setReplyDraft(c.id, undefined);
                          setFromAi(false);
                          setNote(TEMPLATES[type]);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
                      >
                        <X className="h-3.5 w-3.5" />
                        ไม่ใช้ร่างนี้
                      </button>
                    </div>
                    <p className="mt-1.5 text-ink">
                      ข้อความด้านล่างมาจากร่างของ AI Simulation — <b>ยังไม่ได้ส่งถึงลูกค้า</b> กรุณาตรวจสอบ แก้ไข เลือกรูปแบบการตอบกลับ แล้วกด "ส่งการตอบกลับ" ด้วยตนเอง
                    </p>
                  </div>
                )}
                <Field label="รูปแบบการตอบกลับ">
                  <Select
                    value={type}
                    onChange={(e) => {
                      const t = e.target.value as OfferType;
                      setType(t);
                      // แทนที่ข้อความเฉพาะเมื่อยังเป็นข้อความตัวอย่าง — ไม่ลบข้อความที่ร้านพิมพ์เองหรือร่างจาก AI
                      if (!note.trim() || Object.values(TEMPLATES).includes(note)) setNote(TEMPLATES[t]);
                      if (t === 'refund' && !amount) setAmount(c.orderAmount);
                    }}
                  >
                    {Object.entries(OFFER_TYPE).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                {type === 'refund' && (
                  <Field label="จำนวนเงินที่เสนอคืน (บาท) — จำลอง" hint={`มูลค่าคำสั่งซื้อ ${c.orderAmount.toLocaleString()} บาท · ไม่มีการโอนเงินจริง`}>
                    <Input type="number" min={0} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
                  </Field>
                )}
                <Field label="ข้อความถึงผู้บริโภค" error={err}>
                  <Textarea id="reply-note" rows={fromAi ? 9 : 4} value={note} onChange={(e) => setNote(e.target.value)} invalid={!!err} />
                </Field>
                <Field label="แนบคำชี้แจง/หลักฐาน (จำลอง)">
                  <MockUpload value={att} onChange={setAtt} kinds={['หลักฐานการจัดส่ง', 'คำชี้แจง']} max={1} />
                </Field>
                <Button block icon={Send} onClick={submit}>
                  ส่งการตอบกลับ
                </Button>
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="ข้อเสนอที่ส่งแล้ว" />
            <div className="p-4 sm:p-5">
              <OfferList c={c} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <div className="p-4 sm:p-5">
              <Timeline events={c.timeline} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
