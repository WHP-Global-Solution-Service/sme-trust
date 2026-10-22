import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, CheckCircle2, Circle, ClipboardCheck, PlayCircle, Printer, RotateCcw, XCircle } from 'lucide-react';
import { useTrainingStore, toast } from '@/stores';
import { completeLesson, startCourse, submitQuiz } from '@/stores/workflows';
import { useCurrentOperator } from '@/hooks/useCurrent';
import { courses } from '@/mock/data';
import { fmtDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Alert, Button, Card, CardHeader, PageHeader } from '@/components/common/ui';
import { Logo } from '@/components/common/Trust';
import NotFoundPage from '@/features/onboarding/NotFoundPage';

export default function CoursePage() {
  const { courseId } = useParams();
  const op = useCurrentOperator()!;
  const course = courses.find((c) => c.id === courseId);
  const e = useTrainingStore((s) => s.items.find((x) => x.operatorId === op.id && x.courseId === courseId));
  const [view, setView] = useState<string>('overview'); // overview | lessonId | quiz | result
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number }>();
  if (!course) return <NotFoundPage />;

  const lessonsDone = e?.completedLessonIds.length ?? 0;
  const allLessons = lessonsDone >= course.lessons.length;
  const lesson = course.lessons.find((l) => l.id === view);
  const lessonIdx = course.lessons.findIndex((l) => l.id === view);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={course.title} subtitle={`${course.code} · ${course.summary}`} back={{ to: '/m/training', label: 'ศูนย์อบรม' }} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader title="บทเรียน" subtitle={`เรียนแล้ว ${lessonsDone}/${course.lessons.length}`} />
          <ul className="p-2">
            {course.lessons.map((l, i) => {
              const done = e?.completedLessonIds.includes(l.id);
              return (
                <li key={l.id}>
                  <button
                    disabled={!e}
                    onClick={() => setView(l.id)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm disabled:opacity-50', view === l.id ? 'bg-primary-50 text-primary' : 'hover:bg-bg')}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <Circle className="h-4 w-4 shrink-0 text-line" />}
                    {i + 1}. {l.title}
                  </button>
                </li>
              );
            })}
            <li>
              <button
                disabled={!allLessons}
                onClick={() => {
                  setAnswers([]);
                  setView('quiz');
                }}
                className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm disabled:opacity-50', view === 'quiz' ? 'bg-primary-50 text-primary' : 'hover:bg-bg')}
              >
                {e?.passed ? <Award className="h-4 w-4 text-warning" /> : <ClipboardCheck className="h-4 w-4" />}
                แบบทดสอบ {e?.bestScore !== undefined && `(สูงสุด ${e.bestScore}%)`}
              </button>
            </li>
          </ul>
          {!allLessons && e && <p className="px-4 pb-3 text-xs text-ink-soft">เรียนให้ครบทุกบทเพื่อเปิดแบบทดสอบ</p>}
        </Card>

        <div>
          {view === 'overview' && (
            <Card className="p-5">
              <p className="text-ink">{course.summary}</p>
              <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                <li>• {course.lessons.length} บทเรียน ใช้เวลาประมาณ {course.durationMin} นาที</li>
                <li>• แบบทดสอบ {course.quiz.length} ข้อ เกณฑ์ผ่าน {course.passScore}%</li>
                <li>• ผ่านแล้วได้รับ Certificate of Completion (จำลอง) และบันทึกใน SME Trust Passport</li>
              </ul>
              {e?.passed && (
                <Button className="mt-4" variant="outline" icon={Award} onClick={() => setView('result')}>
                  ดูใบรับรองการอบรม
                </Button>
              )}
              <Button
                className="ml-0 mt-4 sm:ml-2"
                icon={PlayCircle}
                onClick={() => {
                  if (!e) startCourse(op.id, course.id);
                  setView(course.lessons.find((l) => !e?.completedLessonIds.includes(l.id))?.id ?? course.lessons[0].id);
                }}
              >
                {e ? 'เรียนต่อ' : 'เริ่มเรียน'}
              </Button>
            </Card>
          )}

          {lesson && (
            <Card className="p-5">
              <p className="text-xs text-ink-soft">
                บทที่ {lessonIdx + 1}/{course.lessons.length}
              </p>
              <h2 className="text-lg font-bold text-ink">{lesson.title}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">
                {lesson.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-2">
                <Button variant="outline" disabled={lessonIdx === 0} onClick={() => setView(course.lessons[lessonIdx - 1].id)}>
                  บทก่อนหน้า
                </Button>
                <Button
                  icon={CheckCircle2}
                  onClick={() => {
                    completeLesson(op.id, course.id, lesson.id);
                    const nextL = course.lessons[lessonIdx + 1];
                    if (nextL) setView(nextL.id);
                    else {
                      toast.success('เรียนครบทุกบทแล้ว', 'ทำแบบทดสอบได้เลย');
                      setAnswers([]);
                      setView('quiz');
                    }
                  }}
                >
                  {lessonIdx === course.lessons.length - 1 ? 'จบบทเรียน → แบบทดสอบ' : 'เรียนจบบทนี้ → บทถัดไป'}
                </Button>
              </div>
            </Card>
          )}

          {view === 'quiz' && (
            <Card className="p-5">
              <h2 className="text-lg font-bold text-ink">แบบทดสอบ</h2>
              <p className="text-sm text-ink-soft">ตอบให้ครบทุกข้อ เกณฑ์ผ่าน {course.passScore}%</p>
              <ol className="mt-4 space-y-5">
                {course.quiz.map((q, qi) => (
                  <li key={q.id}>
                    <p className="font-medium text-ink">
                      {qi + 1}. {q.q}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {q.options.map((o, oi) => (
                        <label key={oi} className={cn('flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm', answers[qi] === oi ? 'border-primary bg-primary-50/60' : 'border-line hover:bg-bg')}>
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[qi] === oi}
                            onChange={() => {
                              const a = [...answers];
                              a[qi] = oi;
                              setAnswers(a);
                            }}
                            className="accent-primary"
                          />
                          {o}
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                className="mt-5"
                block
                onClick={() => {
                  if (course.quiz.some((_, i) => answers[i] === undefined)) return toast.error('กรุณาตอบให้ครบทุกข้อ');
                  setResult(submitQuiz(op.id, course.id, answers));
                  setView('result');
                }}
              >
                ส่งคำตอบ
              </Button>
            </Card>
          )}

          {view === 'result' && (
            <div className="space-y-4">
              {result && (
                <Card className="p-5 text-center">
                  {result.passed ? <CheckCircle2 className="mx-auto h-14 w-14 text-success" /> : <XCircle className="mx-auto h-14 w-14 text-error" />}
                  <p className="mt-2 text-3xl font-bold text-ink">{result.score}%</p>
                  <p className="text-sm text-ink-soft">
                    ตอบถูก {result.correct}/{result.total} ข้อ · {result.passed ? 'ผ่านการอบรม' : `ยังไม่ผ่าน (เกณฑ์ ${course.passScore}%)`}
                  </p>
                  {!result.passed && (
                    <Button
                      className="mt-4"
                      icon={RotateCcw}
                      onClick={() => {
                        setAnswers([]);
                        setView('quiz');
                      }}
                    >
                      ทำแบบทดสอบอีกครั้ง
                    </Button>
                  )}
                </Card>
              )}
              {e?.passed && (
                <>
                  <div className="rounded-2xl border-4 border-double border-primary/40 bg-white p-6 text-center">
                    <div className="flex justify-center">
                      <Logo />
                    </div>
                    <p className="mt-4 text-sm uppercase tracking-widest text-ink-soft">Certificate of Completion (Demo)</p>
                    <p className="mt-3 text-sm text-ink-soft">ขอมอบไว้เพื่อแสดงว่า</p>
                    <p className="text-2xl font-bold text-primary">{op.name}</p>
                    <p className="mt-2 text-sm text-ink-soft">ได้ผ่านการอบรมหลักสูตร</p>
                    <p className="text-lg font-semibold text-ink">{course.title}</p>
                    <p className="mt-3 text-sm text-ink-soft">
                      คะแนน {e.bestScore}% · วันที่ {fmtDate(e.completedAt)} · เลขที่ {e.certificateNo}
                    </p>
                    <p className="mt-3 text-xs font-medium text-secondary">ตัวอย่างใบรับรองสำหรับสาธิต — ไม่ใช่วุฒิบัตรที่ออกโดยหน่วยงานจริง</p>
                  </div>
                  <Button variant="outline" icon={Printer} onClick={() => window.print()}>
                    พิมพ์ใบรับรอง
                  </Button>
                  <Alert tone="success">บันทึกผลใน Training Profile และ SME Trust Passport แล้ว</Alert>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
