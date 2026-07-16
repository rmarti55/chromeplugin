import { useEffect, useState, useCallback } from "react";
import {
  getSessionsForDay,
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

const todayStr = () => toDateStr(Date.now());
const hasChrome = typeof chrome !== "undefined" && chrome.runtime;

function useDayData(date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sessions = await getSessionsForDay(date, Date.now());
    const analysis = await getAnalysis(date);
    const topDomains = aggregateByDomain(sessions);
    const totalMinutes = Math.round(sessions.reduce((s, x) => s + x.seconds, 0) / 60);
    // Prefer AI categories when available, else the local heuristic buckets.
    const categories =
      analysis && analysis.categories?.length ? analysis.categories : categorizeSessions(sessions);
    setData({ sessions, analysis, topDomains, totalMinutes, categories });
    setLoading(false);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const [date, setDate] = useState(params.get("date") || todayStr());
  const [days, setDays] = useState([]);
  const [summarizing, setSummarizing] = useState(false);
  const [msg, setMsg] = useState(null);
  const { data, loading, reload } = useDayData(date);

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
      if (chrome.runtime.lastError) {
        setMsg(chrome.runtime.lastError.message);
      } else if (res && res.ok) {
        reload();
      } else {
        setMsg(res?.error || "Something went wrong.");
      }
    });
  };

  const analysis = data?.analysis;

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
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
        </div>
      </header>

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
        <div className="mb-6 p-3 rounded-lg bg-red-950/60 border border-red-900/60 text-red-300 text-sm">
          {msg}
        </div>
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
              totalMinutes={data.totalMinutes}
              topDomains={data.topDomains}
            />
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <p className="text-slate-300">
                {data.totalMinutes >= 60
                  ? `${Math.floor(data.totalMinutes / 60)}h ${data.totalMinutes % 60}m`
                  : `${data.totalMinutes}m`}{" "}
                of active time tracked. Click <span className="text-indigo-400 font-medium">Summarize</span> for
                your AI narrative.
              </p>
            </div>
          )}

          <CategoryChart categories={data.categories} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SessionsList sessions={data.sessions} />
            {analysis ? <ThemeList themes={analysis.themes} /> : null}
          </div>

          {analysis ? <Timeline timeline={analysis.timeline} /> : null}
        </div>
      )}
    </div>
  );
}
