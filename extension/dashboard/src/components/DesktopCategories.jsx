import { formatDuration } from "../../../db.js";
import { LABELS } from "../../../labels.js";
import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";
import { Metric } from "./ui/Metric.jsx";

export function DesktopCategories({ categories }) {
  if (!categories?.length) return null;

  return (
    <Card>
      <SectionHeader
        title="Desktop app categories"
        subtitle="Time in use in non-browser apps (local rules)."
      />
      <ul className="divide-y divide-stone-100 mt-4">
        {categories.map((c) => (
          <li key={c.name} className="flex justify-between py-2.5 text-sm">
            <span className="font-medium text-stone-800">{c.name}</span>
            <Metric className="text-sm">{formatDuration(c.seconds ?? c.minutes * 60)}</Metric>
          </li>
        ))}
      </ul>
    </Card>
  );
}
