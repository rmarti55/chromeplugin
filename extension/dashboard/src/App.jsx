import { useEffect, useState, useCallback } from "react";
import {
  getSessionsForDay,
  getHourlyForDay,
  aggregateByDomain,
  getAnalysis,
  listActivityDays,
  listAnalysisDays,
  toDateStr,
} from "../../db.js";
import { categorizeSessions } from "../../categorize.js";
import { DailySummary } from "./components/DailySummary.jsx";
import { CategoryChart } from "./components/CategoryChart.jsx";
import { ThemeList } from "./components/ThemeList.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { SessionsList } from "./components/SessionsList.jsx";
import { LiveStatus } from "./components/LiveStatus.jsx";
import { Settings } from "./components/Settings.jsx";

const todayStr = () => toDateStr(Date.now());
const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

function useCategoryCache() {
  const [cache, setCache] = useState(undefined);
  useEffect(() => {
    if (!hasChrome || !chrome.storage) return;
    const load = () => chrome.storage.local.get("domainCategories", (d) => setCache(d.domainCategories || {}));
    load();
    // refresh when a summary run updates the map
    chrome.storage.onChanged.addListener(load);
    return () => chrome.storage.onChanged.removeListener(load);
  }, []);
  return cache;
}

function useDayData(date, cache) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const now = Date.now();
    const [sessions, analysis, timeline] = await Promise.all([
      getSessionsForDay(date, now),
      getAnalysis(date),
      getHourlyForDay(date, now),
    ]);
    const topDomains = aggregateByDomain(sessions);
    const totalSeconds = sessions.reduce((s, x) => s + x.seconds, 0);
    // Prefer AI categories when present, else local (cache-aware) buckets.
    const categories =
      analysis && analysis.categories?.length ? analysis.categories : categorizeSessions(sessions, cache);
    setData({ sessions, analysis, topDomains, totalSeconds, categories, timeline });
    setLoading(false);
  }, [date, cache]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Live refresh while viewing today.
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
  const [days, setDays] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cache = useCategoryCache();
  const { data, loading, reload } = useDayData(date, cache);

  const isToday = date === todayStr();

  useEffect(() => {
    Promise.all([listActivityDays(), listAnalysisDays()]).then(([a, b]) => {
      const merged = [...new Set([todayStr(), ...a, ...b])].sort().reverse();
      setDays(merged.slice(0, 14));
    });
  }, [data]);

  const summarize = () => {
    if (!hasChrome) return;
    setSummarizing(true);
    setMsg(null);
    chrome.runtime.sendMessage({ type: "ANALYZE_DAY", date }, (res) => {
      setSummarizing(false);
      if (chrome.runtime.lastError) setMsg(chrome.runtime.lastError.message);
      else if (res && res.ok) reload();
      else setMsg(res?.error || "Something went wrong.");
    });
  };

  const analysis = data?.analysis;

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

      {isToday && <LiveStatus totalSeconds={data?.totalSeconds} />}

      {days.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
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

      {msg && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/60 border border-red-900/60 text-red-300 text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="text-slate-500 py-20 text-center">Loading…</div>
      ) : !data || data.sessions.length === 0 ? (
        <div className="text-slate-500 py-20 text-center">
          No activity tracked for {date}. Browse a little, then come back.
        </div>
      ) : (
        <div className="space-y-6">
          {analysis ? (
            <DailySummary
              summary={analysis.summary}
              observation={analysis.observation}
              goalAssessment={analysis.goalAssessment}
              totalSeconds={data.totalSeconds}
              topDomains={data.topDomains}
            />
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <p className="text-slate-300">
                Tracked and categorized locally. Click{" "}
                <span className="text-indigo-400 font-medium">Summarize</span> for your AI narrative.
              </p>
            </div>
          )}

          <CategoryChart categories={data.categories} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SessionsList sessions={data.sessions} categoryCache={cache} />
            {analysis ? <ThemeList themes={analysis.themes} /> : null}
          </div>

          <Timeline timeline={data.timeline} />
        </div>
      )}

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
