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
import { LABELS } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";

const BAR_COLORS = ["#92400e", "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fde68a"];

function barColor(seconds, maxSeconds) {
  if (maxSeconds <= 0) return BAR_COLORS[BAR_COLORS.length - 1];
  const ratio = seconds / maxSeconds;
  const step = Math.min(BAR_COLORS.length - 1, Math.floor((1 - ratio) * BAR_COLORS.length));
  return BAR_COLORS[step];
}

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e7e5e4",
  borderRadius: "8px",
  color: "#1c1917",
  fontSize: "13px",
};

export function CategoryChart({ categories, merged }) {
  if (!categories || categories.length === 0) return null;

  const chartData = categories.map((c) => ({
    ...c,
    seconds: c.seconds ?? Math.round((c.minutes || 0) * 60),
  }));
  const maxSeconds = Math.max(...chartData.map((c) => c.seconds));

  return (
    <Card>
      <SectionHeader
        title={merged ? LABELS.dayByCategory : "Categories"}
        subtitle={
          merged
            ? "Chrome websites and other Mac apps — separate clocks, shared category view."
            : "Using Chrome by category."
        }
      />
      <div className="h-72 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis type="number" stroke="#a8a29e" fontSize={12} tickFormatter={(v) => formatDuration(v)} />
            <YAxis type="category" dataKey="name" stroke="#a8a29e" fontSize={12} width={120} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatDuration(value), "Time"]} />
            <Bar dataKey="seconds" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={barColor(entry.seconds, maxSeconds)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
