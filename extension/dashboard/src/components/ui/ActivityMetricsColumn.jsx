import { ActivityBar } from "./ActivityBar.jsx";

export const METRICS_COLUMN_CLASS = "w-[7.75rem] sm:w-[9.25rem]";

export function ActivityMetricsColumn({ metric, navs, barValue, barMax, className = "" }) {
  const showNavs = navs != null && navs > 0;

  return (
    <div className={`shrink-0 ${METRICS_COLUMN_CLASS} flex flex-col items-stretch gap-1 ${className}`}>
      <div className="flex items-center justify-end gap-3 text-right tabular-nums">
        {showNavs && <span className="text-stone-600 text-sm">{navs} navs</span>}
        {metric}
      </div>
      <ActivityBar value={barValue} max={barMax} className="w-full" />
    </div>
  );
}
