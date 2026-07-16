import { useEffect, useState } from "react";

const hasChrome = typeof chrome !== "undefined" && chrome.storage;

// Settings panel: API key, model, and weekly goals live here (behind a gear),
// not in the popup. Persists to chrome.storage.local, the same store the
// service worker reads when generating the summary.
export function Settings({ open, onClose }) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [goals, setGoals] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!hasChrome) return;
    chrome.storage.local.get(["apiKey", "model", "goals"], (d) => {
      setApiKey(d.apiKey || "");
      setModel(d.model || "");
      setGoals(d.goals || "");
    });
  }, [open]);

  const save = () => {
    if (hasChrome) chrome.storage.local.set({ apiKey, model, goals });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mt-16"
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

        <label className="block text-xs text-slate-400 mb-1">Model (optional)</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="anthropic/claude-sonnet-4.5"
          autoComplete="off"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-5"
        />

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
