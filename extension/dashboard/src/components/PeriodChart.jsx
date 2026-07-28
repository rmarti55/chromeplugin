import {
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatDuration } from "../../../db.js";

const BAR_COLOR = "#6366f1";
const BAR_COLOR_DIM = "#334155";
const BAR_COLOR_ACTIVE = "#818cf8";

const tooltipStyle = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
};

function formatTooltipLabel(entry, metricLabel) {
  if (entry.date) return entry.date;
  if (entry.startDate && entry.endDate) {
    return entry.startDate === entry.endDate
      ? entry.startDate
      : `${entry.startDate} – ${entry.endDate}`;
  }
  return entry.label;
}

export function PeriodChart({
  title,
  subtitle,
  metricLabel,
  totalActive,
  bars,
  selectedKey,
  onBarClick,
}) {
  if (!bars?.length) return null;

  const chartData = bars.map((b) => ({
    ...b,
    fill: b.hasActivity ? BAR_COLOR : BAR_COLOR_DIM,
  }));

  const handleClick = (data) => {
    if (!data?.payload || !onBarClick) return;
    onBarClick(data.payload);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {totalActive > 0 && (
          <div className="text-right">
            <div className="tabular-nums text-indigo-300 font-semibold">{formatDuration(totalActive)}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">{metricLabel} total</div>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Each bar is {metricLabel.toLowerCase()} — a within-period breakdown, not a week-vs-week comparison.
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatDuration(v)}
              width={56}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
              formatter={(value, _name, props) => [
                formatDuration(value),
                metricLabel,
              ]}
              labelFormatter={(_label, payload) => {
                const entry = payload?.[0]?.payload;
                return entry ? formatTooltipLabel(entry, metricLabel) : "";
              }}
            />
            <Bar
              dataKey="seconds"
              radius={[4, 4, 0, 0]}
              cursor={onBarClick ? "pointer" : "default"}
              onClick={handleClick}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={
                    entry.key === selectedKey
                      ? BAR_COLOR_ACTIVE
                      : entry.hasActivity
                        ? BAR_COLOR
                        : BAR_COLOR_DIM
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {onBarClick && (
        <p className="text-xs text-slate-600 mt-3">Click a bar to drill into that day or week.</p>
      )}
    </div>
  );
}
