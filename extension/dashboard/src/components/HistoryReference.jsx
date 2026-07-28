import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";

const ALIGNMENT_LABELS = {
  aligned: null,
  mirror_low: "Mirror tracked fewer visits",
  history_low: "History has fewer visits",
  dwell_high: "History est. dwell higher than active time",
  noise: "New tab / homepage noise",
};

function HistoryTable({ rows }) {
  if (!rows.length) {
    return <p className="text-sm text-stone-500">No History entries for this day.</p>;
  }

  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-stone-500 border-b border-stone-200">
            <th className="pb-2 pr-3 font-medium">Domain</th>
            <th className="pb-2 pr-3 font-medium text-right">Hist. visits</th>
            <th className="pb-2 pr-3 font-medium text-right">Hist. est.</th>
            <th className="pb-2 pr-3 font-medium text-right">{LABELS.activeChrome}</th>
            <th className="pb-2 pr-3 font-medium text-right">{LABELS.passiveChrome}</th>
            <th className="pb-2 font-medium text-right">Navs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => {
            const flag = ALIGNMENT_LABELS[row.alignment];
            const highlight = row.alignment !== "aligned" && row.alignment !== "noise";
            const label = row.label || row.domain;
            return (
              <tr
                key={row.domain}
                className={highlight ? "bg-amber-50/50" : undefined}
                title={flag || undefined}
              >
                <td className="py-2 pr-3 text-stone-800 truncate max-w-[140px]">{label}</td>
                <td className="py-2 pr-3 text-stone-500 text-right tabular-nums">
                  {row.historyVisits}
                </td>
                <td className="py-2 pr-3 text-stone-500 text-right tabular-nums">
                  {formatDuration(row.historyDwellSeconds || 0)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  <Metric className="text-sm">{formatDuration(row.mirrorActiveSeconds)}</Metric>
                </td>
                <td className="py-2 pr-3 text-stone-500 text-right tabular-nums">
                  {formatDuration(row.mirrorOpenSeconds || 0)}
                </td>
                <td className="py-2 text-stone-500 text-right tabular-nums">
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
      <summary className="text-xs text-stone-500 cursor-pointer hover:text-stone-700 list-none flex items-center gap-1">
        <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
        Full History alignment ({alignment.rows.length} domains)
      </summary>
      <p className="text-xs text-stone-500 mt-2 mb-1">
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
      <Card>
        <SectionHeader title="Chrome History (reference)" />
        <p className="text-xs text-stone-500 mt-2">
          Chrome History API unavailable in this context. Open the dashboard from the extension.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionHeader title="Chrome History (reference)" />
      <HistoryReferenceDetails alignment={alignment} />
    </Card>
  );
}
