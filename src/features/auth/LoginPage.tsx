import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Fingerprint, Lock, ScanFace, UserRound } from 'lucide-react';
import { useOperatorStore, useSessionStore, toast } from '@/stores';
import { resetPin } from '@/stores/workflows';
import { DEMO_PIN } from '@/mock/data';
import { demoOtp } from '@/utils/id';
import { maskPhone } from '@/utils/format';
import { Alert, Button } from '@/components/common/ui';
import { Modal } from '@/components/common/Modal';
import { Field, Input } from '@/components/forms/Field';
import { OtpInput, PinDots, PinPad } from '@/components/forms/PinPad';
import { AuthFrame } from '@/features/onboarding/AuthFrame';

const MAX_ATTEMPTS = 5;

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/m';
  const { operatorId, set } = useSessionStore();
  const operators = useOperatorStore((s) => s.items);
  const op = operators.find((o) => o.id === operatorId);

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [bio, setBio] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [forgot, setForgot] = useState<{ stage: 'otp' | 'pin' | 'confirm'; otp: string; input: string; pin: string; pin2: string; err: string } | null>(null);

  const login = () => {
    set({ role: 'merchant', merchantLoggedIn: true });
    toast.success('เข้าสู่ระบบสำเร็จ', op?.name);
    nav(from);
  };

  useEffect(() => {
    if (pin.length !== 6 || !op) return;
    if (pin === op.demoPin) {
      login();
      return;
    }
    const n = attempts + 1;
    setAttempts(n);
    setError(n >= MAX_ATTEMPTS ? 'กรอก PIN ผิดครบ 5 ครั้ง บัญชีถูกล็อกชั่วคราว (จำลอง) กรุณาตั้ง PIN ใหม่' : `PIN ไม่ถูกต้อง (เหลือ ${MAX_ATTEMPTS - n} ครั้ง)`);
    // ล้างทันที — ไม่ให้ตัวเลขที่กดต่อเนื่องหายระหว่างรอ (ข้อความผิดพลาดยังแสดงอยู่)
    setPin('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    if (bio !== 'scanning') return;
    const t = setTimeout(() => setBio('done'), 1600);
    return () => clearTimeout(t);
  }, [bio]);

  const locked = attempts >= MAX_ATTEMPTS;

  if (!op)
    return (
      <AuthFrame back="/">
        <div className="space-y-4">
          <UserRound className="h-10 w-10 text-primary" />
          <h1 className="text-xl font-bold text-ink">เข้าสู่ระบบ</h1>
          <Field label="เบอร์โทรศัพท์ที่ลงทะเบียน">
            <Input value={phoneQuery} onChange={(e) => setPhoneQuery(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={10} placeholder="08xxxxxxxx" />
          </Field>
          <Button
            block
            size="lg"
            onClick={() => {
              const found = operators.find((o) => o.phone === phoneQuery);
              if (!found) return toast.error('ไม่พบบัญชีที่ใช้เบอร์นี้', 'ลองใช้เบอร์ตัวอย่าง 0810000001 หรือลงทะเบียนใหม่');
              set({ operatorId: found.id });
            }}
          >
            ถัดไป
          </Button>
          <Alert tone="info">บัญชีตัวอย่าง: 0810000001 – 0810000011 · PIN {DEMO_PIN}</Alert>
          <Button block variant="ghost" onClick={() => nav('/register')}>
            ลงทะเบียนผู้ใช้ใหม่
          </Button>
        </div>
      </AuthFrame>
    );

  return (
    <AuthFrame back="/">
      <div className="space-y-6 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-50 text-xl font-bold text-primary">{op.name.charAt(0)}</div>
          <p className="mt-2 font-semibold text-ink">{op.name}</p>
          <p className="text-sm text-ink-soft">{maskPhone(op.phone)}</p>
        </div>
        {locked ? (
          <div className="space-y-3">
            <Lock className="mx-auto h-10 w-10 text-error" />
            <Alert tone="error">{error}</Alert>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-3 font-medium text-ink">กรอก PIN 6 หลัก</p>
              <PinDots length={6} filled={pin.length} error={!!error && pin.length === 6} />
              {error && <p className="mt-2 text-sm text-error">{error}</p>}
            </div>
            <PinPad value={pin} onChange={setPin} onBiometric={() => setBio('scanning')} />
            <Button variant="secondary" icon={Fingerprint} onClick={() => setBio('scanning')}>
              เข้าสู่ระบบด้วยลายนิ้วมือ (จำลอง)
            </Button>
            <p className="text-sm text-ink-soft">บัญชีตัวอย่างใช้ PIN {DEMO_PIN} · PIN ใช้เพื่อการสาธิตเท่านั้น</p>
          </>
        )}
        <div className="flex flex-col gap-1">
          <Button variant="ghost" onClick={() => setForgot({ stage: 'otp', otp: demoOtp(), input: '', pin: '', pin2: '', err: '' })}>
            ลืม PIN?
          </Button>
          <Button variant="ghost" onClick={() => set({ operatorId: '' })}>
            ใช้บัญชีอื่น
          </Button>
        </div>
      </div>

      {/* Biometric simulation */}
      <Modal open={bio !== 'idle'} onClose={() => setBio('idle')} title="เข้าสู่ระบบด้วยชีวมิติ (จำลอง)">
        <div className="space-y-4 py-2 text-center">
          <div className="relative mx-auto grid h-24 w-24 place-items-center">
            {bio === 'scanning' && <span className="absolute inset-0 animate-pulseRing rounded-full border-4 border-primary" />}
            {bio === 'scanning' ? <Fingerprint className="h-14 w-14 text-primary" /> : <ScanFace className="h-14 w-14 text-success" />}
          </div>
          <p className="text-sm text-ink-soft">{bio === 'scanning' ? 'แตะเซนเซอร์... (ไม่มีการอ่านข้อมูลชีวมิติจริง)' : 'ยืนยันสำเร็จ'}</p>
          {bio === 'done' && (
            <Button
              block
              onClick={() => {
                setBio('idle');
                login();
              }}
            >
              เข้าสู่ระบบ
            </Button>
          )}
        </div>
      </Modal>

      {/* Forgot PIN (จำลอง) */}
      <Modal open={!!forgot} onClose={() => setForgot(null)} title="ตั้ง PIN ใหม่ (จำลอง)">
        {forgot && (
          <div className="space-y-4 text-center">
            {forgot.stage === 'otp' && (
              <>
                <p className="text-sm text-ink-soft">ยืนยัน OTP ที่ส่งไปยัง {maskPhone(op.phone)}</p>
                <Alert tone="warning" title="รหัส OTP สาธิต">
                  <span className="font-mono text-xl font-bold tracking-widest text-ink">{forgot.otp}</span>
                </Alert>
                <OtpInput value={forgot.input} onChange={(v) => setForgot({ ...forgot, input: v, err: '' })} invalid={!!forgot.err} />
                {forgot.err && <p className="text-sm text-error">{forgot.err}</p>}
                <Button
                  block
                  onClick={() => (forgot.input === forgot.otp ? setForgot({ ...forgot, stage: 'pin', err: '' }) : setForgot({ ...forgot, err: 'รหัส OTP ไม่ถูกต้อง' }))}
                >
                  ยืนยัน OTP
                </Button>
              </>
            )}
            {forgot.stage !== 'otp' && (
              <>
                <p className="font-medium text-ink">{forgot.stage === 'pin' ? 'ตั้ง PIN ใหม่' : 'ยืนยัน PIN ใหม่'}</p>
                <PinDots length={6} filled={(forgot.stage === 'pin' ? forgot.pin : forgot.pin2).length} />
                {forgot.err && <p className="text-sm text-error">{forgot.err}</p>}
                <PinPad
                  value={forgot.stage === 'pin' ? forgot.pin : forgot.pin2}
                  onChange={(v) => {
                    if (forgot.stage === 'pin') {
                      setForgot({ ...forgot, pin: v, err: '', stage: v.length === 6 ? 'confirm' : 'pin' });
                    } else if (v.length === 6) {
                      if (v !== forgot.pin) return setForgot({ ...forgot, pin2: '', err: 'PIN ไม่ตรงกัน' });
                      resetPin(op.id, v);
                      setForgot(null);
                      setAttempts(0);
                      setError('');
                      setPin('');
                      toast.success('ตั้ง PIN ใหม่สำเร็จ', 'กรุณาเข้าสู่ระบบด้วย PIN ใหม่');
                    } else setForgot({ ...forgot, pin2: v });
                  }}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </AuthFrame>
  );
}
