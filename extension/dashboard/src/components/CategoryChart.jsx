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

const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];

const tooltipStyle = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
};

export function CategoryChart({ categories }) {
  if (!categories || categories.length === 0) return null;

  const chartData = categories.map((c) => ({
    ...c,
    seconds: c.seconds ?? Math.round((c.minutes || 0) * 60),
  }));

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Categories</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatDuration(v)} />
            <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={120} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatDuration(value), "Time"]} />
            <Bar dataKey="seconds" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
