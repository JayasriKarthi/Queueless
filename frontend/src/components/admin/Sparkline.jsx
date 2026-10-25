// A tiny SVG sparkline (no axes) for metric tiles.
export default function Sparkline({ data, width = 96, height = 28, color = '#0E9F8E', label }) {
  if (!data?.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / Math.max(1, data.length - 1);
  const points = data.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 6)]);
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? `Trend over ${data.length} days`} className="overflow-visible">
      <polygon points={area} fill={color} opacity=".1" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
