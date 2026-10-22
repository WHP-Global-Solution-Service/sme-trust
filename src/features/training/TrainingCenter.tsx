import { Link } from 'react-router-dom';
import { Award, Clock, GraduationCap } from 'lucide-react';
import { useTrainingStore } from '@/stores';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { courses } from '@/mock/data';
import { Alert, Badge, Card, PageHeader, Stat } from '@/components/common/ui';

export default function TrainingCenter() {
  const op = useCurrentOperator();
  const enrollments = useTrainingStore((s) => s.items.filter((e) => e.operatorId === op?.id));
  const passed = enrollments.filter((e) => e.passed).length;

  return (
    <div>
      <PageHeader title="ศูนย์อบรมผู้ประกอบการ" subtitle="เรียนรู้การค้าออนไลน์อย่างเป็นธรรม — ผลการอบรมบันทึกใน Training Profile และ SME Trust Passport" icon={GraduationCap} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="หลักสูตรทั้งหมด" value={courses.length} icon={GraduationCap} />
        <Stat label="กำลังเรียน" value={enrollments.filter((e) => !e.passed).length} icon={Clock} tone="warning" />
        <Stat label="ผ่านแล้ว" value={passed} icon={Award} tone="success" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => {
          const e = enrollments.find((x) => x.courseId === c.id);
          const pct = e ? Math.round(((e.completedLessonIds.length + (e.passed ? 1 : 0)) / (c.lessons.length + 1)) * 100) : 0;
          return (
            <Link key={c.id} to={`/m/training/${c.id}`}>
              <Card className="flex h-full flex-col p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between">
                  <Badge tone="primary">{c.code}</Badge>
                  {e?.passed ? <Badge tone="success">ผ่านแล้ว</Badge> : e ? <Badge tone="warning">กำลังเรียน</Badge> : <Badge>ยังไม่เริ่ม</Badge>}
                </div>
                <p className="mt-3 font-semibold text-ink">{c.title}</p>
                <p className="mt-1 flex-1 text-sm text-ink-soft">{c.summary}</p>
                <p className="mt-3 text-xs text-ink-soft">
                  {c.lessons.length} บทเรียน · แบบทดสอบ {c.quiz.length} ข้อ · ~{c.durationMin} นาที
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-soft">ความคืบหน้า {pct}%{e?.bestScore !== undefined && ` · คะแนนสูงสุด ${e.bestScore}%`}</p>
              </Card>
            </Link>
          );
        })}
      </div>
      <Alert tone="neutral" className="mt-4">เนื้อหาเป็นตัวอย่างเพื่อการสาธิต ไม่ใช่คำปรึกษาทางกฎหมายอย่างเป็นทางการ</Alert>
    </div>
  );
}
