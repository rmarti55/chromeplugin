import { formatDuration } from "../../../db.js";

const ALIGNMENT_LABELS = {
  aligned: null,
  mirror_low: "Mirror tracked fewer visits",
  history_low: "History has fewer visits",
  dwell_high: "History est. dwell higher than active",
  noise: "New tab / homepage noise",
};

function HistoryTable({ rows }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">No History entries for this day.</p>;
  }

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-700/50">
            <th className="pb-2 pr-3 font-medium">Domain</th>
            <th className="pb-2 pr-3 font-medium text-right">Hist. visits</th>
            <th className="pb-2 pr-3 font-medium text-right">Hist. est.</th>
            <th className="pb-2 pr-3 font-medium text-right">Mirror active</th>
            <th className="pb-2 pr-3 font-medium text-right">Chrome open</th>
            <th className="pb-2 font-medium text-right">Navs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {rows.map((row) => {
            const flag = ALIGNMENT_LABELS[row.alignment];
            const highlight = row.alignment !== "aligned" && row.alignment !== "noise";
            const label = row.label || row.domain;
            return (
              <tr
                key={row.domain}
                className={highlight ? "bg-amber-500/5" : undefined}
                title={flag || undefined}
              >
                <td className="py-2 pr-3 text-slate-300 truncate max-w-[140px]">{label}</td>
                <td className="py-2 pr-3 text-slate-400 text-right tabular-nums">
                  {row.historyVisits}
                </td>
                <td className="py-2 pr-3 text-slate-400 text-right tabular-nums">
                  {formatDuration(row.historyDwellSeconds || 0)}
                </td>
                <td className="py-2 pr-3 text-indigo-400/90 text-right tabular-nums">
                  {formatDuration(row.mirrorActiveSeconds)}
                </td>
                <td className="py-2 pr-3 text-sky-400/80 text-right tabular-nums">
                  {formatDuration(row.mirrorOpenSeconds || 0)}
                </td>
                <td className="py-2 text-slate-400 text-right tabular-nums">
                  {row.mirrorVisits}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Expandable full History alignment table — nested under unified site list. */
export function HistoryReferenceDetails({ alignment }) {
  if (!alignment?.available) return null;

  const rows = alignment.rows.slice(0, 30);

  return (
    <details className="mt-4 group">
      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 list-none flex items-center gap-1">
        <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
        Full History alignment ({alignment.rows.length} domains)
      </summary>
      <p className="text-xs text-slate-600 mt-2 mb-1">
        Visit log from Chrome — not used for Mirror time totals. Est. dwell = time until the next
        page load (gap proxy).
      </p>
      <HistoryTable rows={rows} />
    </details>
  );
}

/** @deprecated Standalone card — kept for compatibility; dashboard uses SessionsList + details. */
export function HistoryReference({ alignment }) {
  if (!alignment?.available) {
    return (
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Chrome History (reference)</h2>
        <p className="text-xs text-slate-500">
          Chrome History API unavailable in this context. Open the dashboard from the extension.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Chrome History (reference)</h2>
      <HistoryReferenceDetails alignment={alignment} />
    </div>
  );
}
