import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";

const THEME_INTENSITY = [
  "bg-amber-100 text-amber-950 border-amber-300",
  "bg-amber-50 text-amber-900 border-amber-200",
  "bg-accent-softer text-amber-900 border-amber-100",
  "bg-white text-stone-800 border-stone-200",
  "bg-white text-stone-700 border-stone-200",
  "bg-white text-stone-600 border-stone-100",
];

function themeIntensityClass(minutes, maxMinutes) {
  if (maxMinutes <= 0) return THEME_INTENSITY[THEME_INTENSITY.length - 1];
  const ratio = minutes / maxMinutes;
  const step = Math.min(
    THEME_INTENSITY.length - 1,
    Math.floor((1 - ratio) * THEME_INTENSITY.length)
  );
  return THEME_INTENSITY[step];
}

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
            className={`p-4 rounded-lg border ${themeIntensityClass(theme.minutes || 0, maxMinutes)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">{theme.name}</span>
              <Metric className="text-sm">{theme.minutes} min</Metric>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(theme.sites || []).map((site) => (
                <span key={site} className="text-xs px-2 py-0.5 rounded-full bg-stone-900/5 text-stone-600">
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
