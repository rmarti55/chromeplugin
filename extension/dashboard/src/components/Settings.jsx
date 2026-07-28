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
    <div className="fixed inset-0 bg-stone-900/20 flex items-start justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-white border border-stone-200 rounded-2xl p-6 w-full max-w-md mt-16 max-h-[90vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-lg font-medium text-stone-900">Settings</h2>
          <button onClick={onClose} className="text-stone-600 hover:text-stone-900 text-xl leading-none">×</button>
        </div>

        <label className="block text-sm text-stone-700 mb-1">This week I'm trying to…</label>
        <textarea
          rows={3}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="e.g. ship the Solyra landing page; avoid Twitter before noon"
          className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 mb-4 resize-y shadow-sm"
        />

        <label className="block text-sm text-stone-700 mb-1">OpenRouter API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-…"
          autoComplete="off"
          className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 mb-1 shadow-sm"
        />
        <p className="text-sm text-stone-600 mb-4">
          Stored only on this device. Get one at{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
            openrouter.ai/keys
          </a>
          .
        </p>

        <p className="text-sm text-stone-700 mb-1">Summary model</p>
        <p className="text-sm text-stone-800 mb-1">{MODEL_LABEL}</p>
        <p className="text-sm text-stone-600 mb-4 font-mono">{DEFAULT_MODEL} · ~$0.001 per summary</p>

        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSummaryHourly}
            onChange={(e) => setAutoSummaryHourly(e.target.checked)}
            className="mt-1 rounded border-stone-300 bg-white text-accent focus:ring-accent"
          />
          <span>
            <span className="block text-sm text-stone-800">Auto-summarize hourly</span>
            <span className="block text-sm text-stone-600 mt-0.5">
              Refreshes today&apos;s summary about once an hour when you&apos;ve been active.
              Skips API calls when nothing new happened. Manual summarize always works.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-700">Saved</span>}
          <button onClick={save} className="bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
