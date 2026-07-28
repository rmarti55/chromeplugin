export function ActivityBar({ value = 0, max = 0, className = "" }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div
      className={`h-1 rounded-full bg-stone-100 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
