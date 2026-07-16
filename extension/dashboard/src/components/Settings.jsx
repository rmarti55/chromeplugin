import { useEffect, useState } from "react";
import { DEFAULT_MODEL, MODEL_LABEL } from "../../../models.js";

const hasChrome = typeof chrome !== "undefined" && chrome.storage;

export function Settings({ open, onClose }) {
  const [apiKey, setApiKey] = useState("");
  const [goals, setGoals] = useState("");
  const [autoSummaryHourly, setAutoSummaryHourly] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hasChrome) return;
    chrome.storage.local.get(["apiKey", "goals", "autoSummaryHourly"], (d) => {
      setApiKey(d.apiKey || "");
      setGoals(d.goals || "");
      setAutoSummaryHourly(d.autoSummaryHourly !== false);
    });
  }, [open]);

  const save = () => {
    if (hasChrome) {
      chrome.storage.local.set({ apiKey, goals, autoSummaryHourly });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mt-16 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        <label className="block text-xs text-slate-400 mb-1">This week I'm trying to…</label>
        <textarea
          rows={3}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="e.g. ship the Solyra landing page; avoid Twitter before noon"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-4 resize-y"
        />

        <label className="block text-xs text-slate-400 mb-1">OpenRouter API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-…"
          autoComplete="off"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-1"
        />
        <p className="text-[11px] text-slate-500 mb-4">
          Stored only on this device. Get one at{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-indigo-400">
            openrouter.ai/keys
          </a>
          .
        </p>

        <p className="text-xs text-slate-400 mb-1">Summary model</p>
        <p className="text-sm text-slate-200 mb-1">{MODEL_LABEL}</p>
        <p className="text-[11px] text-slate-500 mb-4 font-mono">{DEFAULT_MODEL} · ~$0.001 per summary</p>

        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSummaryHourly}
            onChange={(e) => setAutoSummaryHourly(e.target.checked)}
            className="mt-1 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
          />
          <span>
            <span className="block text-sm text-slate-200">Auto-summarize hourly</span>
            <span className="block text-[11px] text-slate-500 mt-0.5">
              Refreshes today&apos;s summary about once an hour when you&apos;ve been active.
              Skips API calls when nothing new happened. Manual summarize always works.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-400">Saved</span>}
          <button onClick={save} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg px-4 py-2">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
