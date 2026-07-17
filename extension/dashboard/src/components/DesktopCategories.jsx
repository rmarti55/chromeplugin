import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";

export function DesktopCategories({ categories }) {
  if (!categories?.length) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Desktop app categories</h2>
      <p className="text-xs text-slate-500 mb-4">Time in use in non-browser apps (local rules).</p>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.name} className="flex justify-between text-sm">
            <span className="text-slate-300">{c.name}</span>
            <span className="text-slate-400 tabular-nums">{formatDuration(c.seconds ?? c.minutes * 60)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
