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
import { LABELS, quietDaysCountLabel, quietWeekBarDetail } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";

const BAR_COLOR = "#b45309";
const BAR_COLOR_DIM = "#d6d3d1";
const BAR_COLOR_ACTIVE = "#92400e";

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e7e5e4",
  borderRadius: "8px",
  color: "#1c1917",
  fontSize: "14px",
};

function formatTooltipLabel(entry) {
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
  quietDayCount = 0,
  periodKind,
  bars,
  selectedKey,
  onBarClick,
}) {
  if (!bars?.length) return null;

  const chartData = bars.map((b) => ({
    ...b,
    fill: b.hasActivity || b.seconds > 0 ? BAR_COLOR : BAR_COLOR_DIM,
  }));

  const handleClick = (data) => {
    if (!data?.payload || !onBarClick) return;
    onBarClick(data.payload);
  };

  const quietLabel = quietDayCount > 0 ? quietDaysCountLabel(quietDayCount, periodKind) : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader title={title} subtitle={subtitle} />
        <div className="text-right shrink-0">
          <div className="tabular-nums text-accent font-semibold text-lg">
            {formatDuration(totalActive)}
          </div>
          <div className="text-xs uppercase tracking-wide text-stone-500">{metricLabel} total</div>
          {quietLabel && <div className="text-xs text-stone-500 mt-1">{quietLabel}</div>}
        </div>
      </div>
      <p className="text-sm text-stone-600 mt-4 mb-4">
        Each bar is {metricLabel.toLowerCase()} — a within-period breakdown, not a week-vs-week comparison.
      </p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="label" stroke="#57534e" fontSize={14} tickLine={false} />
            <YAxis
              stroke="#57534e"
              fontSize={14}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatDuration(v)}
              width={56}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "rgba(180, 83, 9, 0.08)" }}
              formatter={(value, _name, props) => {
                const entry = props?.payload;
                if (entry && !entry.hasActivity && entry.seconds === 0) {
                  if (entry.activeDayCount != null && entry.quietDayCount != null) {
                    const detail = quietWeekBarDetail(entry.activeDayCount, entry.quietDayCount);
                    return [detail ? `${LABELS.quietDayTooltip} (${detail})` : LABELS.quietDayTooltip, ""];
                  }
                  return [LABELS.quietDayTooltip, ""];
                }
                return [formatDuration(value), metricLabel];
              }}
              labelFormatter={(_label, payload) => {
                const entry = payload?.[0]?.payload;
                return entry ? formatTooltipLabel(entry) : "";
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
                      : entry.hasActivity || entry.seconds > 0
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
        <p className="text-sm text-stone-500 mt-3">Click a bar to drill into that day or week.</p>
      )}
    </Card>
  );
}
