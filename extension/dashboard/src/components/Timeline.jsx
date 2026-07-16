export function Timeline({ timeline }) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
      <h2 className="text-lg font-semibold text-slate-100 mb-4">Timeline</h2>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-600" />
        <div className="space-y-4">
          {timeline.map((entry, i) => (
            <div key={i} className="relative pl-10">
              <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-800" />
              <div>
                <span className="text-sm font-medium text-indigo-400">{entry.hour}</span>
                <p className="text-sm text-slate-300 mt-0.5">{entry.activity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
