import { useCallback, useEffect, useState } from "react";
import { getWeekBreakdown, getMonthBreakdown } from "../../../periods.js";
import { fetchDesktopDay } from "../desktop-client.js";
import { dmLog, dmWarn } from "../../../log.js";

export function usePeriodData(viewMode, anchorDate) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (viewMode === "day") {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const start = performance.now();
    try {
      const breakdown =
        viewMode === "week"
          ? await getWeekBreakdown(anchorDate, { fetchDesktopDay })
          : await getMonthBreakdown(anchorDate, { fetchDesktopDay });

      const ms = Math.round(performance.now() - start);
      dmLog("dashboard", "periodLoad.ok", {
        viewMode,
        anchorDate,
        ms,
        barCount: breakdown.bars.length,
        totalActive: breakdown.totalActive,
      });
      setData(breakdown);
    } catch (err) {
      dmWarn("dashboard", "periodLoad.fail", {
        viewMode,
        anchorDate,
        err: err?.message || String(err),
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [viewMode, anchorDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, reload: load };
}
