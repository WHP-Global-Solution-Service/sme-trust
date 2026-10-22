import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useOperatorStore, useTrainingStore } from '@/stores';
import { courses } from '@/mock/data';
import { fmtDate } from '@/utils/format';
import { Badge, Card, CardHeader, PageHeader } from '@/components/common/ui';
import { DataTable } from '@/components/common/DataTable';
import { SearchBox, Select } from '@/components/forms/Field';
import { ChartTable, HBarChart } from '@/components/common/Charts';

export default function TrainingRecords() {
  const [params] = useSearchParams();
  const enrollments = useTrainingStore((s) => s.items);
  const ops = useOperatorStore((s) => s.items);
  const [course, setCourse] = useState(params.get('course') ?? '');
  const [q, setQ] = useState('');
  const name = (id: string) => ops.find((o) => o.id === id)?.name ?? id;
  const rows = enrollments.filter((e) => (!course || e.courseId === course) && (!q || name(e.operatorId).includes(q))).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const chart = courses.map((c) => ({ name: c.title, value: enrollments.filter((e) => e.courseId === c.id && e.passed).length }));

  return (
    <div>
      <PageHeader title="Training Records" subtitle="ผลการอบรมของผู้ประกอบการ (เชื่อมกับ SME Trust Passport)" icon={BookOpen} />
      <Card className="mb-4">
        <CardHeader title="จำนวนผู้ผ่านการอบรมแยกตามหลักสูตร" />
        <div className="p-4">
          <HBarChart data={chart} />
          <ChartTable data={chart} valueLabel="ผู้ผ่าน" />
        </div>
      </Card>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchBox value={q} onChange={setQ} placeholder="ค้นหาชื่อผู้ประกอบการ" />
        <Select value={course} onChange={(e) => setCourse(e.target.value)} className="sm:w-72" aria-label="หลักสูตร">
          <option value="">ทุกหลักสูตร</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
      </div>
      <Card>
        <DataTable
          rows={rows}
          mobileTitle={(e) => name(e.operatorId)}
          columns={[
            { key: 'op', header: 'ผู้ประกอบการ', render: (e) => name(e.operatorId), sort: (e) => name(e.operatorId), hideOnMobile: true },
            { key: 'c', header: 'หลักสูตร', render: (e) => courses.find((c) => c.id === e.courseId)?.title },
            { key: 'p', header: 'บทเรียน', render: (e) => `${e.completedLessonIds.length}/${courses.find((c) => c.id === e.courseId)?.lessons.length}` },
            { key: 's', header: 'คะแนนสูงสุด', render: (e) => (e.bestScore !== undefined ? `${e.bestScore}%` : '-'), sort: (e) => e.bestScore ?? -1 },
            { key: 'r', header: 'ผล', render: (e) => (e.passed ? <Badge tone="success">ผ่าน</Badge> : <Badge tone="warning">กำลังเรียน</Badge>) },
            { key: 'd', header: 'วันที่ผ่าน', render: (e) => fmtDate(e.completedAt), sort: (e) => e.completedAt ?? '' },
            { key: 'n', header: 'เลขที่ใบรับรอง', render: (e) => <span className="font-mono text-xs">{e.certificateNo ?? '-'}</span>, hideOnMobile: true },
          ]}
        />
      </Card>
    </div>
  );
}
