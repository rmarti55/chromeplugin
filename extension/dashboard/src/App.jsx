import { useEffect, useState, useCallback } from "react";
import {
  getDayMetrics,
  getAnalysis,
  listActivityDays,
  listAnalysisDays,
  toDateStr,
} from "../../db.js";
import { getHistoryForDay, compareDayToHistory } from "../../history.js";
import { categorizeSessions } from "../../categorize.js";
import { mergeDesktopWithChrome } from "../../desktop-merge.js";
import { mergeCategories } from "../../categorize-apps.js";
import { fetchDesktopDay } from "./desktop-client.js";
import { DailySummary } from "./components/DailySummary.jsx";
import { CategoryChart } from "./components/CategoryChart.jsx";
import { ThemeList } from "./components/ThemeList.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { SessionsList } from "./components/SessionsList.jsx";
import { LiveStatus } from "./components/LiveStatus.jsx";
import { DesktopApps } from "./components/DesktopApps.jsx";
import { Settings } from "./components/Settings.jsx";
import { dmLog, dmWarn, dmError, dmOnChange } from "../../log.js";

const todayStr = () => toDateStr(Date.now());
const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sites", label: "Sites" },
  { id: "categories", label: "Categories" },
  { id: "timeline", label: "Timeline" },
];

function useCategoryCache() {
  const [cache, setCache] = useState(undefined);
  useEffect(() => {
    if (!hasChrome || !chrome.storage) return;
    const load = () => chrome.storage.local.get("domainCategories", (d) => setCache(d.domainCategories || {}));
    load();
    chrome.storage.onChanged.addListener(load);
    return () => chrome.storage.onChanged.removeListener(load);
  }, []);
  return cache;
}

function useDayData(date, cache) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const start = performance.now();
    const now = Date.now();
    const [metrics, analysis, history, desktopRaw] = await Promise.all([
      getDayMetrics(date, now),
      getAnalysis(date),
      getHistoryForDay(date, now).catch((err) => {
        dmWarn("dashboard", "dayLoad.historyFail", { date, err: err?.message || String(err) });
        return {
          domains: [],
          historyVisitCount: 0,
          historyDomainCount: 0,
          available: false,
        };
      }),
      fetchDesktopDay(date),
    ]);
    const desktop = mergeDesktopWithChrome(metrics, desktopRaw);
    const ms = Math.round(performance.now() - start);
    dmLog("dashboard", "dayLoad.ok", {
      date,
      ms,
      sessionCount: metrics.sessions?.length ?? 0,
      desktopAvailable: desktop.available,
      desktopAppCount: desktop.otherApps?.length ?? 0,
      hasAnalysis: !!analysis,
    });
    dmOnChange(`dayLoad.desktop.${date}`, { available: desktop.available }, (state) => {
      dmLog("dashboard", "dayLoad.desktopFlip", { date, ...state });
    });
    const { sessions, topDomains, timeline, domainHints, activeSeconds, openSeconds } = metrics;
    const historyAlignment = compareDayToHistory(metrics, history);
    const chromeCategories =
      analysis && analysis.categories?.length ? analysis.categories : categorizeSessions(sessions, cache);
    const categories = desktop.available
      ? mergeCategories(chromeCategories, desktop.categories)
      : chromeCategories;
    const displayTimeline =
      desktop.available && desktop.mergedTimeline?.length ? desktop.mergedTimeline : timeline;

    setData({
      sessions,
      analysis,
      topDomains,
      activeSeconds,
      openSeconds,
      categories,
      timeline: displayTimeline,
      timelineMerged: desktop.available,
      domainHints,
      historyAlignment,
      desktop,
      desktopRaw,
    });
    setLoading(false);
  }, [date, cache]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (date !== todayStr()) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [date, load]);

  return { data, loading, reload: load };
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [date, setDate] = useState(params.get("date") || todayStr());
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [macLive, setMacLive] = useState(null);
  const cache = useCategoryCache();
  const { data, loading, reload } = useDayData(date, cache);

  const isToday = date === todayStr();

  useEffect(() => {
    setTab("overview");
  }, [date]);

  useEffect(() => {
    Promise.all([listActivityDays(), listAnalysisDays()]).then(([a, b]) => {
      const merged = [...new Set([todayStr(), ...a, ...b])].sort().reverse();
      setDays(merged.slice(0, 14));
    });
  }, [data]);

  const summarize = async () => {
    if (!hasChrome) return;
    setSummarizing(true);
    setMsg(null);
    let desktopPayload = data?.desktopRaw ?? null;
    if (!desktopPayload?.apps?.length) {
      dmLog("dashboard", "summarize.refetchDesktop", { date });
      desktopPayload = await fetchDesktopDay(date);
    }
    dmLog("dashboard", "summarize.start", {
      date,
      hasDesktopPayload: !!(desktopPayload?.apps?.length),
    });
    const start = performance.now();
    chrome.runtime.sendMessage(
      { type: "ANALYZE_DAY", date, desktopPayload },
      (res) => {
        const ms = Math.round(performance.now() - start);
        setSummarizing(false);
        if (chrome.runtime.lastError) {
          dmError("dashboard", "summarize.fail", {
            date,
            ms,
            err: chrome.runtime.lastError.message,
          });
          setMsg(chrome.runtime.lastError.message);
        } else if (res && res.ok) {
          dmLog("dashboard", "summarize.ok", {
            date,
            ms,
            includedDesktop: res.analysis?.includedDesktop,
          });
          reload();
        } else {
          dmWarn("dashboard", "summarize.fail", { date, ms, err: res?.error || "unknown" });
          setMsg(res?.error || "Something went wrong.");
        }
      }
    );
  };

  const analysis = data?.analysis;
  const hasActivity =
    data &&
    (data.sessions.length > 0 ||
      data.openSeconds > 0 ||
      data.desktop?.available);

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Daily Mirror</h1>
          <p className="text-slate-500 text-sm">A private, on-device look at your day.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
          />
          <button
            onClick={summarize}
            disabled={summarizing || !hasChrome}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            {summarizing ? "Writing…" : analysis ? "Re-summarize" : "✨ Summarize"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-3 py-2"
          >
            ⚙
          </button>
        </div>
      </header>

      {days.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {days.map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                d === date
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-600"
              }`}
            >
              {d === todayStr() ? "Today" : d}
            </button>
          ))}
        </div>
      )}

      {!loading && hasActivity && (
        <nav className="flex gap-1 mb-6 border-b border-slate-700/60">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === id
                  ? "text-indigo-300 border-indigo-500"
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {msg && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/60 border border-red-900/60 text-red-300 text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="text-slate-500 py-20 text-center">Loading…</div>
      ) : !hasActivity ? (
        <div className="text-slate-500 py-20 text-center">
          No activity tracked for {date}. Browse a little, then come back.
        </div>
      ) : (
        <div>
          {tab === "overview" && (
            <div className="space-y-6">
              {analysis ? (
                <DailySummary
                  summary={analysis.summary}
                  analyzedAt={analysis.analyzedAt}
                  includedDesktop={analysis.includedDesktop}
                  desktop={data.desktop}
                />
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                  <p className="text-slate-300">
                    Tracked and categorized locally. Click{" "}
                    <span className="text-indigo-400 font-medium">Summarize</span> for your AI narrative.
                  </p>
                </div>
              )}
              {isToday && (
                <LiveStatus
                  openSeconds={data.openSeconds}
                  activeSeconds={data.activeSeconds}
                  desktop={data.desktop}
                  onLiveChange={setMacLive}
                />
              )}
              <DesktopApps
                desktop={data.desktop}
                chromeOpenSeconds={data.openSeconds}
                chromeActiveSeconds={data.activeSeconds}
                live={macLive}
              />
            </div>
          )}

          {tab === "sites" && (
            <div className="space-y-6">
              <SessionsList
                sessions={data.sessions}
                categoryCache={cache}
                domainHints={data.domainHints}
                historyAlignment={data.historyAlignment}
              />
              {analysis ? <ThemeList themes={analysis.themes} /> : null}
            </div>
          )}

          {tab === "categories" && (
            <div className="space-y-6">
              <CategoryChart categories={data.categories} merged={data.desktop?.available} />
            </div>
          )}

          {tab === "timeline" && (
            <Timeline timeline={data.timeline} merged={data.timelineMerged} />
          )}
        </div>
      )}

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
