import { formatDuration } from "../../../db.js";
import { categorize } from "../../../categorize.js";
import { HINT_LABELS } from "../../../heuristics.js";
import { displayLabel, pageContextSubtitle } from "../../../siteIdentity.js";
import { HistoryReferenceDetails } from "./HistoryReference.jsx";
import { LABELS } from "../../../labels.js";

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
    <div className="flex items-start justify-between text-sm gap-3 rounded-lg px-1 py-1">
      <div className="min-w-0 flex-1">
        <div className="text-slate-200 truncate">{label}</div>
        <div className="text-slate-500 text-xs truncate">
          <SiteSubtitle row={row} />
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3 text-right tabular-nums">
        {!row.isNoiseRollup && row.mirrorVisits > 0 && (
          <span className="text-slate-500 text-xs">{row.mirrorVisits} navs</span>
        )}
        <span className="text-indigo-400 font-medium w-16">
          {formatDuration(row.mirrorActiveSeconds || 0)}
        </span>
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
      className={`flex items-start justify-between text-sm gap-3 rounded-lg px-1 py-1 ${
        highlight ? "bg-amber-500/5" : ""
      }`}
      title={flag || undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div className="text-slate-200 truncate">{label}</div>
          {row.isHistoryOnly && (
            <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-700/80 text-slate-400 border border-slate-600/50">
              History only
            </span>
          )}
          {badge && (
            <span
              className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300/90 border border-amber-500/25"
              title={hint.hintNote || badge}
            >
              {badge}
            </span>
          )}
          {flag && row.alignment !== "noise" && (
            <span className="shrink-0 text-[10px] text-amber-400/80">{flag}</span>
          )}
        </div>
        <div className="text-slate-500 text-xs truncate">
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
        <span className="text-indigo-400 font-medium w-16">
          {formatDuration(row.mirrorActiveSeconds || 0)}
        </span>
        {hasHistory ? (
          <>
            <span className="text-sky-400/70 text-xs w-14 hidden sm:block">
              {showOpen ? formatDuration(row.mirrorOpenSeconds) : "—"}
            </span>
            <span className="text-slate-500 text-xs w-14 hidden sm:block">
              {row.historyVisits || "—"}
            </span>
            <span className="text-slate-500 text-xs w-14 hidden sm:block">
              {row.historyDwellSeconds ? formatDuration(row.historyDwellSeconds) : "—"}
            </span>
          </>
        ) : (
          showOpen && (
            <span className="text-sky-400/70 text-xs">
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
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Where your time went</h2>
      <p className="text-xs text-slate-500 mb-4">Using Chrome per site, ranked by time spent.</p>

      <div className="space-y-2">
        {displayRows.map((row) => (
          <SimpleRow key={row.domain} row={row} />
        ))}
      </div>

      {hasHistory && historyAlignment.rows.length > displayRows.length && (
        <p className="text-xs text-slate-600 mt-3">
          Showing top {displayRows.length} of {historyAlignment.rows.length} domains.
        </p>
      )}

      {hasHistory && (
        <details className="mt-4 group">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            Compare with Chrome History
          </summary>
          {historyAlignment.summary && (
            <p className="text-sm text-slate-400 mt-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
              {historyAlignment.summary}
              {historyAlignment.trend && (
                <span className="block text-xs text-slate-500 mt-1">{historyAlignment.trend}</span>
              )}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-3 mb-2">
            {LABELS.usingChrome} (measured) with {LABELS.inChrome.toLowerCase()} and History reference per domain.
            History est. dwell is a gap proxy — not added to totals.
          </p>
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 text-[10px] uppercase tracking-wide text-slate-600 mb-2 px-1">
            <span>Site</span>
            <span className="text-right w-16">Using</span>
            <span className="text-right w-14">In Chrome</span>
            <span className="text-right w-14">Hist.</span>
            <span className="text-right w-14">Est.</span>
          </div>
          <div className="space-y-2">
            {displayRows.map((row) => {
              const hint = row.isNoiseRollup ? null : domainHints[row.domain];
              return <DiagnosticRow key={row.domain} row={row} hint={hint} hasHistory={hasHistory} />;
            })}
          </div>
          <HistoryReferenceDetails alignment={historyAlignment} />
        </details>
      )}
    </div>
  );
}
