import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";
import { ActivityBar } from "./ui/ActivityBar.jsx";

export function ThemeList({ themes }) {
  if (!themes || themes.length === 0) return null;

  const sortedThemes = [...themes].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));
  const maxMinutes = Math.max(...sortedThemes.map((t) => t.minutes || 0));

  return (
    <Card>
      <SectionHeader title="Themes" />
      <div className="space-y-3 mt-4">
        {sortedThemes.map((theme, i) => (
          <div
            key={i}
            className="p-4 rounded-lg border border-stone-200 bg-white"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{theme.name}</span>
              <Metric className="text-sm">{theme.minutes} min</Metric>
            </div>
            <ActivityBar value={theme.minutes || 0} max={maxMinutes} className="w-full mb-3" />
            <div className="flex flex-wrap gap-1.5">
              {(theme.sites || []).map((site) => (
                <span key={site} className="text-sm px-2 py-0.5 rounded-full bg-stone-900/5 text-stone-700">
                  {site}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
