import { formatDuration } from "../../../db.js";
import { categorize } from "../../../categorize.js";
import { HINT_LABELS } from "../../../heuristics.js";
import { displayLabel, pageContextSubtitle } from "../../../siteIdentity.js";
import { LABELS } from "../../../labels.js";
import { HistoryReferenceDetails } from "./HistoryReference.jsx";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";

const ALIGNMENT_LABELS = {
  aligned: null,
  mirror_low: "Fewer Mirror visits",
  history_low: "Fewer History visits",
  dwell_high: "Hist. est. > in use",
  noise: "New tab noise",
};

function buildUnifiedRows(sessions, alignment, categoryCache) {
  const sessionByDomain = new Map();
  for (const s of sessions || []) {
    const cur = sessionByDomain.get(s.domain);
    if (!cur || (s.seconds || 0) > (cur.seconds || 0)) {
      sessionByDomain.set(s.domain, s);
    }
  }

  const rows = (alignment?.rows || []).map((row) => {
    const session = row.isNoiseRollup ? null : sessionByDomain.get(row.domain);
    const isHistoryOnly =
      !row.isNoiseRollup &&
      row.mirrorActiveSeconds === 0 &&
      row.mirrorVisits === 0 &&
      row.historyVisits > 0;
    return {
      ...row,
      session,
      isHistoryOnly,
      label: row.isNoiseRollup ? row.label : displayLabel(row.domain, session?.title),
      pageSubtitle: row.isNoiseRollup
        ? null
        : pageContextSubtitle(row.domain, session?.title),
      category: row.isNoiseRollup ? null : categorize(row.domain, categoryCache),
    };
  });

  rows.sort(
    (a, b) =>
      b.mirrorActiveSeconds - a.mirrorActiveSeconds ||
      b.historyVisits - a.historyVisits ||
      b.historyDwellSeconds - a.historyDwellSeconds
  );

  return rows;
}

function SiteSubtitle({ row }) {
  if (row.isNoiseRollup) {
    return "Cmd+T / new-tab homepage landings — not real browsing";
  }
  return (
    <>
      {row.domain}
      {row.category ? ` · ${row.category}` : ""}
      {row.pageSubtitle ? ` · ${row.pageSubtitle}` : ""}
    </>
  );
}

function SimpleRow({ row }) {
  const domain = row.domain;
  const label = row.label || row.session?.title || domain;

  return (
    <div className="flex items-start justify-between text-sm gap-3 py-2.5 border-b border-stone-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-stone-800 truncate">{label}</div>
        <div className="text-stone-600 text-sm truncate mt-0.5">
          <SiteSubtitle row={row} />
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3 text-right tabular-nums">
        {!row.isNoiseRollup && row.mirrorVisits > 0 && (
          <span className="text-stone-600 text-sm">{row.mirrorVisits} navs</span>
        )}
        <Metric className="w-16 text-sm">{formatDuration(row.mirrorActiveSeconds || 0)}</Metric>
      </div>
    </div>
  );
}

function DiagnosticRow({ row, hint, hasHistory }) {
  const domain = row.domain;
  const label = row.label || row.session?.title || domain;
  const badge =
    hint?.automationHint && hint.automationHint !== "none" ? HINT_LABELS[hint.automationHint] : null;
  const flag = ALIGNMENT_LABELS[row.alignment];
  const highlight = row.alignment !== "aligned" && row.alignment !== "noise";
  const showOpen = (row.mirrorOpenSeconds || 0) > (row.mirrorActiveSeconds || 0);

  return (
    <div
      className={`flex items-start justify-between text-sm gap-3 py-2.5 border-b border-stone-100 last:border-0 ${
        highlight ? "bg-accent-soft/50 -mx-1 px-1 rounded" : ""
      }`}
      title={flag || undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="font-medium text-stone-800 truncate">{label}</div>
          {row.isHistoryOnly && (
            <span className="shrink-0 text-sm uppercase tracking-wide px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
              History only
            </span>
          )}
          {badge && (
            <span
              className="shrink-0 text-sm uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent-soft text-accent-dark border border-accent/30"
              title={hint.hintNote || badge}
            >
              {badge}
            </span>
          )}
          {flag && row.alignment !== "noise" && (
            <span className="shrink-0 text-sm text-accent-dark">{flag}</span>
          )}
        </div>
        <div className="text-stone-600 text-sm truncate mt-0.5">
          {row.isNoiseRollup ? (
            "Cmd+T / new-tab homepage landings — not real browsing"
          ) : (
            <>
              {domain}
              {row.category ? ` · ${row.category}` : ""}
              {row.pageSubtitle ? ` · ${row.pageSubtitle}` : ""}
              {row.mirrorVisits > 0 ? ` · ${row.mirrorVisits} navs` : ""}
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3 text-right tabular-nums">
        <Metric className="w-16 text-sm">{formatDuration(row.mirrorActiveSeconds || 0)}</Metric>
        {hasHistory ? (
          <>
            <span className="text-stone-600 text-sm w-14 hidden sm:block">
              {showOpen ? formatDuration(row.mirrorOpenSeconds) : "—"}
            </span>
            <span className="text-stone-600 text-sm w-14 hidden sm:block">
              {row.historyVisits || "—"}
            </span>
            <span className="text-stone-600 text-sm w-14 hidden sm:block">
              {row.historyDwellSeconds ? formatDuration(row.historyDwellSeconds) : "—"}
            </span>
          </>
        ) : (
          showOpen && (
            <span className="text-stone-600 text-sm">
              {LABELS.inChrome.toLowerCase()} {formatDuration(row.mirrorOpenSeconds)}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export function SessionsList({ sessions, categoryCache, domainHints = {}, historyAlignment }) {
  const unified = buildUnifiedRows(sessions, historyAlignment, categoryCache);
  const hasHistory = historyAlignment?.available;
  const displayRows = unified.slice(0, 25);

  if (!displayRows.length && (!sessions || sessions.length === 0)) return null;

  return (
    <Card>
      <SectionHeader
        title="Where your time went"
        subtitle="Using Chrome per site, ranked by time spent."
      />

      <div>
        {displayRows.map((row) => (
          <SimpleRow key={row.domain} row={row} />
        ))}
      </div>

      {hasHistory && historyAlignment.rows.length > displayRows.length && (
        <p className="text-sm text-stone-600 mt-3">
          Showing top {displayRows.length} of {historyAlignment.rows.length} domains.
        </p>
      )}

      {hasHistory && (
        <details className="mt-4 group">
          <summary className="text-sm text-stone-700 cursor-pointer hover:text-stone-900 list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            Compare with Chrome History
          </summary>
          {historyAlignment.summary && (
            <p className="text-sm text-stone-700 mt-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
              {historyAlignment.summary}
              {historyAlignment.trend && (
                <span className="block text-sm text-stone-600 mt-1">{historyAlignment.trend}</span>
              )}
            </p>
          )}
          <p className="text-sm text-stone-600 mt-3 mb-2">
            {LABELS.usingChrome} (measured) with {LABELS.inChrome.toLowerCase()} and History reference per domain.
            History est. dwell is a gap proxy — not added to totals.
          </p>
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 text-sm font-medium text-stone-600 mb-2 px-1">
            <span>Site</span>
            <span className="text-right w-16">Using</span>
            <span className="text-right w-14">In Chrome</span>
            <span className="text-right w-14">Hist.</span>
            <span className="text-right w-14">Est.</span>
          </div>
          <div>
            {displayRows.map((row) => {
              const hint = row.isNoiseRollup ? null : domainHints[row.domain];
              return <DiagnosticRow key={row.domain} row={row} hint={hint} hasHistory={hasHistory} />;
            })}
          </div>
          <HistoryReferenceDetails alignment={historyAlignment} />
        </details>
      )}
    </Card>
  );
}
