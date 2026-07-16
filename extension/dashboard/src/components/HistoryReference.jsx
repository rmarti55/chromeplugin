import { formatDuration } from "../../../db.js";

const ALIGNMENT_LABELS = {
  aligned: null,
  mirror_low: "Mirror tracked fewer visits",
  history_low: "History has fewer visits",
  dwell_high: "History est. dwell higher than active",
};

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

  const rows = alignment.rows.slice(0, 12);

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Chrome History (reference)</h2>
      <p className="text-xs text-slate-500 mb-3">
        Visit log from Chrome — not used for Mirror time totals. Est. dwell = time until the next
        page load (gap proxy).
      </p>
      {alignment.summary && (
        <p className="text-sm text-slate-400 mb-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
          {alignment.summary}
        </p>
      )}
      {alignment.trend && (
        <p className="text-xs text-slate-500 mb-4">{alignment.trend}</p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No History entries for this day.</p>
      ) : (
        <div className="overflow-x-auto">
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
                const highlight = row.alignment !== "aligned";
                return (
                  <tr
                    key={row.domain}
                    className={highlight ? "bg-amber-500/5" : undefined}
                    title={flag || undefined}
                  >
                    <td className="py-2 pr-3 text-slate-300 truncate max-w-[120px]">
                      {row.domain}
                    </td>
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
      )}
    </div>
  );
}
