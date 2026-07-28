import { quietDaySummary, LABELS } from "../../../labels.js";

export function QuietDaySummary({ date, status }) {
  const summary = quietDaySummary(date, status);

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-card">
      <h2 className="text-lg font-semibold text-stone-900 mb-4">Summary</h2>
      <p className="font-serif text-base text-stone-800 leading-relaxed">{summary}</p>
      <p className="text-stone-700 text-sm mt-4 leading-relaxed">{LABELS.quietDayNote}</p>
    </div>
  );
}
