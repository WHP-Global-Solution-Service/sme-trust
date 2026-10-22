import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * จำลองเวลาประมวลผล (0.7 วินาที) ด้วย Client-side Timer — ป้องกันการกดซ้ำ
 * และยกเลิกอัตโนมัติเมื่อออกจากหน้า (ไม่อัปเดต State หลัง Unmount)
 */
export function useSimulatedRun(delay = 700) {
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const run = useCallback(
    (fn: () => void) => {
      if (timer.current && loading) return;
      setLoading(true);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setLoading(false);
        fn();
      }, delay);
    },
    [delay, loading],
  );
  return { loading, run };
}
