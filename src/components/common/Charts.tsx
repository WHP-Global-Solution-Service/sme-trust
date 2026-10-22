import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** สีกราฟ: ใช้สีหลักเดียวสำหรับขนาด (magnitude) และสีสถานะเฉพาะข้อมูลสถานะ */
export const CHART = {
  primary: '#173F94',
  grid: '#E8EDF5',
  axis: '#536984',
  categorical: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};

const tooltipStyle = { borderRadius: 12, border: '1px solid #DCE3EE', fontSize: 13, fontFamily: 'Noto Sans Thai' };
const tick = { fontSize: 12, fill: CHART.axis, fontFamily: 'Noto Sans Thai' };

export interface Datum {
  name: string;
  value: number;
  color?: string;
}

const LABEL_MAX = 18;

/** ป้ายแกน Y ที่ตัดชื่อยาวด้วย "…" (ชื่อเต็มอยู่ใน title และ Tooltip) */
function CategoryTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const full = payload?.value ?? '';
  const text = full.length > LABEL_MAX ? `${full.slice(0, LABEL_MAX - 1)}…` : full;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={CHART.axis} fontFamily="Noto Sans Thai">
      <title>{full}</title>
      {text}
    </text>
  );
}

/** แท่งแนวนอน — เหมาะกับหมวดหมู่ชื่อยาวภาษาไทย */
export function HBarChart({ data, unit = '', height, color = CHART.primary }: { data: Datum[]; unit?: string; height?: number; color?: string }) {
  const h = height ?? Math.max(160, data.length * 38 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: unit ? 56 : 36, left: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={<CategoryTick />} width={130} axisLine={false} tickLine={false} interval={0} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F4F7FC' }} formatter={(v: number) => [`${v.toLocaleString()}${unit}`, 'ค่า']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color ?? color} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#152B49' }} formatter={(v: number) => `${v}${unit.replace(/ /g, ' ')}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** แท่งแนวตั้งตามเวลา */
export function TimeBarChart({ data, label = 'จำนวน', height = 220 }: { data: Datum[]; label?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F4F7FC' }} formatter={(v: number) => [v, label]} />
        <Bar dataKey="value" fill={CHART.primary} radius={[4, 4, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#536984' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** เส้นแนวโน้มหนึ่งชุดข้อมูล */
export function TrendLine({ data, label, unit = '', height = 220 }: { data: Datum[]; label: string; unit?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="name" tick={tick} axisLine={false} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}${unit}`, label]} />
        <Line dataKey="value" stroke={CHART.primary} strokeWidth={2} dot={{ r: 4, fill: CHART.primary, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** ตารางแทนกราฟ (Accessible table view) */
export function ChartTable({ data, unit = '', valueLabel = 'ค่า' }: { data: Datum[]; unit?: string; valueLabel?: string }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs text-primary">ดูเป็นตาราง</summary>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left text-xs text-ink-soft">
            <th className="py-1 font-medium">รายการ</th>
            <th className="py-1 text-right font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.name} className="border-t border-line">
              <td className="py-1">{d.name}</td>
              <td className="py-1 text-right tabular-nums">
                {d.value.toLocaleString()}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
