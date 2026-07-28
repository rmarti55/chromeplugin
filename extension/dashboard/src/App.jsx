import { useEffect, useState, useCallback } from "react";
import {
  getDayMetrics,
  getAnalysis,
  toDateStr,
  formatDisplayDate,
  listRecentCalendarDays,
  classifyDay,
} from "../../db.js";
import { getHistoryForDay, compareDayToHistory } from "../../history.js";
import { categorizeSessions } from "../../categorize.js";
import { mergeDesktopWithChrome } from "../../desktop-merge.js";
import { mergeCategories } from "../../categorize-apps.js";
import { fetchDesktopDay } from "./desktop-client.js";
import { loadDayRollup } from "../../periods.js";
import { DailySummary } from "./components/DailySummary.jsx";
import { QuietDaySummary } from "./components/QuietDaySummary.jsx";
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
    const [metrics, analysis, history, desktopResult] = await Promise.all([
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
    const desktopRaw = desktopResult?.payload ?? null;
    const desktopFetchOk = desktopResult?.fetchOk ?? false;
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

    const dayStatus = classifyDay({
      sessions: metrics.sessions,
      openSeconds: metrics.openSeconds,
      activeSeconds: metrics.activeSeconds,
      desktopAvailable: desktop.available,
      desktopFetchOk,
    });

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
      dayStatus,
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
  const [dayStatuses, setDayStatuses] = useState({});
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
    const calendarDays = listRecentCalendarDays(14);
    setDays(calendarDays);
    const now = Date.now();
    Promise.all(calendarDays.map((d) => loadDayRollup(d, now, fetchDesktopDay))).then((rollups) => {
      const statuses = {};
      for (const r of rollups) statuses[r.date] = r.status;
      setDayStatuses(statuses);
    });
  }, [data?.dayStatus, date]);

  const summarize = async () => {
    if (!hasChrome) return;
    setSummarizing(true);
    setMsg(null);
    let desktopPayload = data?.desktopRaw ?? null;
    if (!desktopPayload?.apps?.length) {
      dmLog("dashboard", "summarize.refetchDesktop", { date });
      const result = await fetchDesktopDay(date);
      desktopPayload = result?.payload ?? null;
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
  const dayStatus = data?.dayStatus ?? "active";
  const hasActivity = dayStatus === "active";

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10 bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-stone-900">Daily Mirror</h1>
          <p className="text-sm text-stone-500 mt-1">A private, on-device look at your day.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 shadow-sm"
          />
          <button
            onClick={summarize}
            disabled={summarizing || !hasChrome || !hasActivity}
            className="bg-accent hover:bg-amber-700 disabled:bg-stone-300 disabled:text-stone-500 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            {summarizing ? "Writing…" : analysis ? "Re-summarize" : "Summarize"}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="text-stone-600 hover:text-stone-900 border border-stone-200 bg-white rounded-lg px-3 py-2 text-sm shadow-sm transition-colors"
          >
            Settings
          </button>
        </div>
      </header>

      {days.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {days.map((d) => {
            const status = dayStatuses[d];
            const isQuiet = status && status !== "active";
            const isSelected = d === date;
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  isSelected
                    ? isQuiet
                      ? "bg-stone-100 text-stone-600 border-stone-300 font-medium"
                      : "bg-accent-soft text-amber-900 border-amber-200 font-medium"
                    : isQuiet
                      ? "bg-stone-50 text-stone-400 border-stone-200 border-dashed hover:border-stone-300 hover:text-stone-600"
                      : "bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:text-stone-700"
                }`}
              >
                {formatDisplayDate(d)}
              </button>
            );
          })}
        </div>
      )}

      {!loading && hasActivity && (
        <nav className="flex gap-1 mb-8 border-b border-stone-200">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === id
                  ? "text-accent border-accent"
                  : "text-stone-500 border-transparent hover:text-stone-700 hover:border-stone-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {msg && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="text-stone-500 py-20 text-center">Loading…</div>
      ) : !hasActivity ? (
        <div className="space-y-6">
          <QuietDaySummary date={date} status={dayStatus} />
          {isToday && (
            <LiveStatus
              openSeconds={data.openSeconds}
              activeSeconds={data.activeSeconds}
              desktop={data.desktop}
              onLiveChange={setMacLive}
            />
          )}
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
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-card">
                  <p className="text-stone-700">
                    Tracked and categorized locally. Click{" "}
                    <span className="text-accent font-semibold">Summarize</span> for your AI narrative.
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
