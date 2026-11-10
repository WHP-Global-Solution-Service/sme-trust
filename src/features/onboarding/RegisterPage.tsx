import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, KeyRound, MessageSquareText, PartyPopper, Smartphone } from 'lucide-react';
import { useOperatorStore, useSessionStore, toast } from '@/stores';
import { reportDemo } from '@/stores/demo';
import { registerOperator } from '@/stores/workflows';
import { PROVINCES } from '@/constants/labels';
import { demoOtp } from '@/utils/id';
import { fmtPhone } from '@/utils/format';
import { Alert, Button, LinkButton } from '@/components/common/ui';
import { Stepper } from '@/components/common/Stepper';
import { Field, Input, Select } from '@/components/forms/Field';
import { OtpInput, PinDots, PinPad } from '@/components/forms/PinPad';
import { AuthFrame } from './AuthFrame';
import { EKycFlow } from './EKycFlow';

/** ปลายทางหลังสมัครที่เลือกจากหน้าแรก (เชื่อมร้านค้าออนไลน์ / ลงทะเบียนด้วยตนเอง) */
const NEXT_LABEL: Record<string, string> = {
  '/m/register-shop/marketplace': 'ไปต่อ: เชื่อมร้านค้าออนไลน์',
  '/m/register-shop': 'ไปต่อ: ลงทะเบียนร้านค้าด้วยตนเอง',
};

const STEPS = ['เบอร์โทรศัพท์', 'ยืนยัน OTP', 'ข้อมูลเริ่มต้น', 'ยืนยันตัวตน', 'ตั้ง PIN', 'สำเร็จ'];

const phoneSchema = z.object({
  phone: z.string().regex(/^0[689]\d{8}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 06, 08 หรือ 09'),
  consent: z.literal(true, { errorMap: () => ({ message: 'กรุณายอมรับเงื่อนไขการใช้งานระบบสาธิต' }) }),
});
const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'กรุณากรอกชื่อ'),
  lastName: z.string().trim().min(2, 'กรุณากรอกนามสกุล'),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  province: z.string().min(1, 'กรุณาเลือกจังหวัด'),
});
type PhoneForm = z.infer<typeof phoneSchema>;
type ProfileForm = z.infer<typeof profileSchema>;

export default function RegisterPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const asked = (loc.state as { next?: string } | null)?.next;
  const nextTarget = asked && asked in NEXT_LABEL ? asked : undefined;
  const operators = useOperatorStore((s) => s.items);
  const setSession = useSessionStore((s) => s.set);
  const [step, setStep] = useState(0);
  useEffect(() => reportDemo('register.step', step), [step]);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [profile, setProfile] = useState<ProfileForm>();
  const [kycOk, setKycOk] = useState<boolean>();
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [pinStage, setPinStage] = useState<1 | 2>(1);
  const [pinErr, setPinErr] = useState('');
  const [newOpId, setNewOpId] = useState('');

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: '' } });
  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), defaultValues: { province: '' } });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const existing = operators.find((o) => o.phone === phone);

  const sendOtp = () => {
    setOtp(demoOtp());
    setOtpInput('');
    setOtpErr('');
    setCooldown(30);
  };

  // ตรวจ PIN อัตโนมัติเมื่อกรอกครบ — เปลี่ยนขั้น/ล้างค่าทันที เพื่อไม่ให้ตัวเลขที่กดต่อเนื่องหายระหว่างรอ
  useEffect(() => {
    if (step !== 4 || newOpId) return;
    if (pinStage === 1 && pin.length === 6) {
      if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') {
        setPinErr('PIN ง่ายเกินไป (เช่น เลขซ้ำหรือเรียงกัน) กรุณาตั้งใหม่');
        setPin('');
        return;
      }
      setPinErr('');
      setPinStage(2);
    }
    if (pinStage === 2 && pin2.length === 6) {
      if (pin2 !== pin) {
        setPinErr('PIN ยืนยันไม่ตรงกัน กรุณากรอกอีกครั้ง');
        setPin2('');
        return;
      }
      const op = registerOperator({ name: `${profile!.firstName} ${profile!.lastName}`, phone, email: profile!.email, province: profile!.province, pin, kycOk });
      setNewOpId(op.id);
      setStep(5);
    }
  }, [step, newOpId, pin, pin2, pinStage, profile, phone, kycOk]);

  const back = step > 0 && step < 5 ? () => setStep(step === 4 ? 3 : step - 1) : undefined;

  return (
    <AuthFrame back={step === 0 ? '/' : undefined} onBack={back}>
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <form
          className="space-y-4"
          onSubmit={phoneForm.handleSubmit((v) => {
            setPhone(v.phone);
            sendOtp();
            setStep(1);
          })}
        >
          <Smartphone className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-ink">กรอกเบอร์โทรศัพท์</h1>
            <p className="text-sm text-ink-soft">ระบบจะแสดงรหัส OTP สาธิตบนหน้าจอ ไม่มีการส่ง SMS จริง</p>
          </div>
          <Field label="เบอร์โทรศัพท์มือถือ" required error={phoneForm.formState.errors.phone?.message} hint="ตัวอย่าง 0891234567 (ใช้เบอร์สมมติได้)">
            <Input inputMode="numeric" maxLength={10} placeholder="08xxxxxxxx" invalid={!!phoneForm.formState.errors.phone} {...phoneForm.register('phone')} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" {...phoneForm.register('consent')} />
            <span>ฉันเข้าใจว่านี่เป็นระบบสาธิต จะไม่กรอกข้อมูลส่วนบุคคลจริง และข้อมูลถูกเก็บในเบราว์เซอร์นี้เท่านั้น</span>
          </label>
          {phoneForm.formState.errors.consent && <p className="text-xs text-error">{phoneForm.formState.errors.consent.message}</p>}
          <Button type="submit" block size="lg">
            ขอรหัส OTP
          </Button>
          <p className="text-center text-sm text-ink-soft">
            มีบัญชีแล้ว?{' '}
            <button type="button" className="font-medium text-primary" onClick={() => nav('/login')}>
              เข้าสู่ระบบ
            </button>
          </p>
        </form>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <MessageSquareText className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-ink">ยืนยันรหัส OTP</h1>
            <p className="text-sm text-ink-soft">รหัส 6 หลักสำหรับเบอร์ {fmtPhone(phone)}</p>
          </div>
          <Alert tone="warning" title="รหัส OTP สาธิต (Demo)">
            <span className="font-mono text-2xl font-bold tracking-[0.3em] text-ink">{otp}</span>
            <br />
            ระบบจริงจะส่งทาง SMS — ในระบบสาธิตแสดงบนหน้าจอเท่านั้น
          </Alert>
          <OtpInput
            value={otpInput}
            onChange={(v) => {
              setOtpInput(v);
              setOtpErr('');
            }}
            invalid={!!otpErr}
          />
          {otpErr && <p className="text-center text-sm text-error">{otpErr}</p>}
          {existing && (
            <Alert tone="info" title="เบอร์นี้เคยลงทะเบียนแล้ว">
              บัญชี {existing.name} ใช้เบอร์นี้อยู่ คุณสามารถเข้าสู่ระบบด้วย PIN แทนได้
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSession({ operatorId: existing.id, role: 'merchant', merchantLoggedIn: false });
                    nav('/login');
                  }}
                >
                  ไปหน้าเข้าสู่ระบบ
                </Button>
              </div>
            </Alert>
          )}
          <Button
            block
            size="lg"
            onClick={() => {
              if (otpInput.length !== 6) return setOtpErr('กรุณากรอก OTP ให้ครบ 6 หลัก');
              if (otpInput !== otp) return setOtpErr('รหัส OTP ไม่ถูกต้อง (OTP Invalid) กรุณาตรวจสอบรหัสที่แสดงด้านบน');
              setStep(2);
            }}
          >
            ยืนยัน
          </Button>
          <Button block variant="ghost" disabled={cooldown > 0} onClick={sendOtp}>
            {cooldown > 0 ? `ขอรหัสใหม่ได้ใน ${cooldown} วินาที` : 'ขอรหัส OTP ใหม่'}
          </Button>
        </div>
      )}

      {step === 2 && (
        <form
          className="space-y-4"
          onSubmit={profileForm.handleSubmit((v) => {
            setProfile(v);
            setStep(3);
          })}
        >
          <div>
            <h1 className="text-xl font-bold text-ink">ข้อมูลเริ่มต้น</h1>
            <p className="text-sm text-ink-soft">กรุณาใช้ชื่อสมมติสำหรับการสาธิต</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ชื่อ" required error={profileForm.formState.errors.firstName?.message}>
              <Input placeholder="เช่น สมใจ" invalid={!!profileForm.formState.errors.firstName} {...profileForm.register('firstName')} />
            </Field>
            <Field label="นามสกุล" required error={profileForm.formState.errors.lastName?.message}>
              <Input placeholder="เช่น ทดลองขาย" invalid={!!profileForm.formState.errors.lastName} {...profileForm.register('lastName')} />
            </Field>
          </div>
          <Field label="อีเมล" required error={profileForm.formState.errors.email?.message}>
            <Input type="email" placeholder="name@demo.local" invalid={!!profileForm.formState.errors.email} {...profileForm.register('email')} />
          </Field>
          <Field label="จังหวัด" required error={profileForm.formState.errors.province?.message}>
            <Select invalid={!!profileForm.formState.errors.province} {...profileForm.register('province')}>
              <option value="">เลือกจังหวัด</option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Button type="submit" block size="lg">
            ถัดไป
          </Button>
        </form>
      )}

      {step === 3 && (
        <EKycFlow
          onDone={(ok) => {
            setKycOk(ok);
            reportDemo('register.kyc', ok ? 'ok' : 'fail');
            setStep(4);
          }}
          onSkip={() => {
            setKycOk(false);
            setStep(4);
          }}
        />
      )}

      {step === 4 && (
        <div className="space-y-6 text-center">
          <KeyRound className="mx-auto h-10 w-10 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-ink">{pinStage === 1 ? 'ตั้ง PIN 6 หลัก' : 'ยืนยัน PIN อีกครั้ง'}</h1>
            <p className="text-sm text-ink-soft">ใช้สำหรับเข้าสู่ระบบสาธิต (ไม่ใช่มาตรการความปลอดภัยจริง)</p>
          </div>
          <PinDots length={6} filled={pinStage === 1 ? pin.length : pin2.length} error={!!pinErr && (pinStage === 1 ? pin.length === 6 : pin2.length === 6)} />
          {pinErr && <p className="text-sm text-error">{pinErr}</p>}
          <PinPad value={pinStage === 1 ? pin : pin2} onChange={pinStage === 1 ? setPin : setPin2} />
          {pinStage === 2 && (
            <Button
              variant="ghost"
              onClick={() => {
                setPin('');
                setPin2('');
                setPinStage(1);
                setPinErr('');
              }}
            >
              ตั้ง PIN ใหม่
            </Button>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-5 text-center">
          <PartyPopper className="mx-auto h-16 w-16 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-ink">ลงทะเบียนสำเร็จ</h1>
            <p className="text-sm text-ink-soft">ยินดีต้อนรับ คุณ{profile?.firstName}</p>
          </div>
          <div className="space-y-2 rounded-2xl bg-white p-4 text-left text-sm">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              เบอร์โทรศัพท์ {fmtPhone(phone)} ยืนยันแล้ว (จำลอง)
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className={kycOk ? 'h-4 w-4 text-success' : 'h-4 w-4 text-line'} />
              {kycOk ? 'ยืนยันตัวตนแล้ว — Level 1 Identity Verified' : 'ยังไม่ยืนยันตัวตน (ทำภายหลังได้ที่หน้าหลัก)'}
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              ตั้ง PIN สำเร็จ
            </p>
          </div>
          <p className="text-sm text-ink-soft">คุณยังไม่จำเป็นต้องลงทะเบียนร้านค้าทันที สามารถเริ่มได้จากหน้าหลักเมื่อพร้อม</p>
          <Button
            block
            size="lg"
            onClick={() => {
              setSession({ role: 'merchant', operatorId: newOpId, merchantLoggedIn: true, activeMerchantId: undefined });
              toast.success('เข้าสู่ระบบแล้ว');
              nav(nextTarget ?? '/m');
            }}
          >
            {nextTarget ? NEXT_LABEL[nextTarget] ?? 'ไปต่อ' : 'เข้าสู่หน้าหลัก'}
          </Button>
          <LinkButton to="/check" variant="ghost" block>
            ไปหน้าตรวจสอบร้านค้า
          </LinkButton>
        </div>
      )}
    </AuthFrame>
  );
}
