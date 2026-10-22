import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink, Maximize2, RotateCcw, RotateCw, X } from 'lucide-react';
import { DEVICES, PREVIEW_PATH, getLastDevice, isEmbedded, setLastDevice, type DeviceId, type PreviewMessage } from '@/utils/devicePreview';
import { cn } from '@/utils/cn';
import { appPath } from '@/utils/appUrl';

/**
 * โหมดจำลองหน้าจอ — แสดงแอปใน iframe ขนาดเท่าอุปกรณ์จริง เพื่อให้ Media Query/Breakpoint ทำงานตามอุปกรณ์นั้น
 * การเปลี่ยนอุปกรณ์เปลี่ยนเฉพาะขนาดกรอบ (ไม่โหลดหน้าใหม่) จึงคงหน้าและข้อมูลที่กำลังสาธิตไว้
 */
export default function DevicePreview() {
  // เปิดหน้าจำลองซ้อนภายในกรอบจำลองไม่ได้ — กลับไปหน้าแรกแทน
  if (isEmbedded()) return <Navigate to="/" replace />;
  return <DevicePreviewStage />;
}

function DevicePreviewStage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialDevice = (params.get('device') as DeviceId) in DEVICES ? (params.get('device') as DeviceId) : getLastDevice() ?? 'phone';
  const [device, setDevice] = useState<DeviceId>(initialDevice);
  const [landscape, setLandscape] = useState(params.get('o') === 'landscape');
  // เปลี่ยนอุปกรณ์ → เริ่มที่แนวตั้งเสมอ (การหมุนจอเป็นของอุปกรณ์ที่กำลังดู ไม่ติดไปอุปกรณ์อื่น)
  const chooseDevice = (id: DeviceId) => {
    setDevice(id);
    setLandscape(false);
  };
  const [path, setPath] = useState(() => {
    const p = params.get('path') ?? '/';
    return p.startsWith('/') && !p.startsWith(PREVIEW_PATH) ? p : '/';
  });
  const [src] = useState(path); // ตั้งครั้งเดียว — การเปลี่ยนอุปกรณ์จะไม่โหลด iframe ใหม่
  const [frameKey, setFrameKey] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  const d = DEVICES[device];
  const rotated = landscape && d.rotatable;
  const w = rotated ? d.height : d.width;
  const h = rotated ? d.width : d.height;
  const bezel = device === 'laptop' ? 12 : 14;
  const base = device === 'laptop' ? 16 : 0; // ฐานโน้ตบุ๊กใต้จอ
  const outerW = w + bezel * 2;
  const outerH = h + bezel * 2 + base;
  const scale = stage.w && stage.h ? Math.min(1, (stage.w - 48) / outerW, (stage.h - 48) / outerH) : 1;

  // ขนาดพื้นที่แสดงผล → คำนวณอัตราย่อให้อุปกรณ์พอดีจอ
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // จดจำอุปกรณ์ล่าสุด และเก็บสถานะไว้ใน URL (Reload แล้วยังอยู่ที่เดิม)
  useEffect(() => {
    setLastDevice(device);
    setParams({ device, path, ...(rotated ? { o: 'landscape' } : {}) }, { replace: true });
  }, [device, path, rotated, setParams]);

  // รับข้อความจากแอปใน iframe: เปลี่ยนเส้นทาง / เลือกอุปกรณ์จาก Demo Mode / ออกจากโหมดจำลอง
  useEffect(() => {
    const onMsg = (e: MessageEvent<PreviewMessage>) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'smetrust:route') setPath(e.data.path);
      if (e.data.type === 'smetrust:device' && e.data.device in DEVICES) chooseDevice(e.data.device);
      if (e.data.type === 'smetrust:exit') nav(e.data.path);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [nav]);

  return (
    <div className="flex h-screen flex-col bg-slate-800">
      {/* แถบเครื่องมือ */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2 text-white">
        <p className="mr-1 hidden text-sm font-semibold md:block">จำลองหน้าจอ</p>
        <div className="flex rounded-xl bg-white/10 p-1" role="radiogroup" aria-label="เลือกอุปกรณ์">
          {Object.values(DEVICES).map((x) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={device === x.id}
              onClick={() => chooseDevice(x.id)}
              className={cn('flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors', device === x.id ? 'bg-white text-primary' : 'text-white/80 hover:bg-white/10')}
            >
              <x.icon className="h-4 w-4" />
              {x.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setLandscape(!landscape)}
          disabled={!d.rotatable}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 disabled:opacity-40"
          title={d.rotatable ? 'หมุนจอ' : 'โน้ตบุ๊กไม่รองรับการหมุนจอ'}
        >
          <RotateCw className="h-4 w-4" />
          <span className="hidden sm:inline">{rotated ? 'แนวนอน' : 'แนวตั้ง'}</span>
        </button>
        <span className="hidden text-xs text-white/60 lg:inline">
          {w} × {h} px · ย่อ {Math.round(scale * 100)}%
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden max-w-[240px] truncate rounded-lg bg-white/10 px-2.5 py-1.5 font-mono text-xs text-white/80 xl:inline" title={path}>
            {path}
          </span>
          <button onClick={() => setFrameKey((k) => k + 1)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="โหลดหน้าใหม่" title="โหลดหน้าใหม่">
            <RotateCcw className="h-4 w-4" />
          </button>
          <a href={appPath(path)} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="เปิดในแท็บใหม่" title="เปิดในแท็บใหม่">
            <ExternalLink className="h-4 w-4" />
          </a>
          <button onClick={() => nav(path)} className="flex h-9 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-medium hover:bg-secondary/90" title="ออกจากโหมดจำลอง">
            <Maximize2 className="h-4 w-4 sm:hidden" />
            <X className="hidden h-4 w-4 sm:block" />
            <span className="hidden sm:inline">ออกจากโหมดจำลอง</span>
          </button>
        </div>
      </header>

      {/* พื้นที่แสดงอุปกรณ์ */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width: outerW, height: outerH, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
        >
          <div style={{ height: h + bezel * 2, padding: bezel }} className={cn('w-full bg-black shadow-2xl ring-1 ring-white/20', device === 'phone' ? 'rounded-[44px]' : device === 'tablet' ? 'rounded-[32px]' : 'rounded-xl')}>
            <iframe
              key={frameKey}
              src={appPath(src)}
              title={`SME Trust — จำลอง${d.label}`}
              width={w}
              height={h}
              className={cn('block bg-white', device === 'phone' ? 'rounded-[32px]' : device === 'tablet' ? 'rounded-[20px]' : 'rounded-md')}
              style={{ width: w, height: h, border: 0 }}
            />
          </div>
          {device === 'laptop' && <div className="h-4 w-full rounded-b-2xl bg-slate-600" />}
        </div>
      </div>
    </div>
  );
}
