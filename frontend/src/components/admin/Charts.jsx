import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useUiStore } from '../../store/uiStore';

export const SERIES = ['#0E9F8E', '#2563EB', '#B28400', '#7C3AED', '#DB2777', '#8A8A8A'];

function useChartTheme() {
  const dark = useUiStore((s) => s.theme === 'dark');
  return {
    axis: dark ? '#A3A3A3' : '#616161',
    grid: dark ? '#262626' : '#EBEBEB',
    tooltip: { background: dark ? '#171717' : '#fff', border: `1px solid ${dark ? '#404040' : '#E3E3E3'}`, borderRadius: 8, fontSize: 12, color: dark ? '#fff' : '#1A1A1A' },
  };
}

const axisProps = (t) => ({ tick: { fontSize: 11, fill: t.axis }, tickLine: false, axisLine: false });

export function BarChartBox({ data, dataKey, xKey = 'label', height = 220, color = SERIES[0], name }) {
  const t = useChartTheme();
  return (
    <div style={{ height }} role="img" aria-label={`${name ?? dataKey} bar chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis dataKey={xKey} {...axisProps(t)} interval="preserveStartEnd" />
          <YAxis {...axisProps(t)} allowDecimals={false} />
          <Tooltip contentStyle={t.tooltip} cursor={{ fill: t.grid, opacity: 0.6 }} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineChartBox({ data, lines, xKey = 'label', height = 220, unit }) {
  const t = useChartTheme();
  return (
    <div style={{ height }} role="img" aria-label={`${lines.map((l) => l.name).join(' and ')} line chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis dataKey={xKey} {...axisProps(t)} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps(t)} allowDecimals={false} unit={unit} />
          <Tooltip contentStyle={t.tooltip} />
          {lines.map((l, i) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color ?? SERIES[i]} strokeWidth={2} dot={false} strokeDasharray={l.dashed ? '4 4' : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, height = 200 }) {
  const t = useChartTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div style={{ height, width: height }} className="relative shrink-0" role="img" aria-label="Service split donut chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
              {data.map((d, i) => <Cell key={d.name} fill={SERIES[i % SERIES.length]} />)}
            </Pie>
            <Tooltip contentStyle={t.tooltip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-medium">{total}</span>
          <span className="ql-subdued">tokens</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-[13px]">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="font-medium">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
