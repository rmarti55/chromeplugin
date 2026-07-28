import { Card } from "./ui/Card.jsx";
import { SectionHeader } from "./ui/SectionHeader.jsx";

function formatAnalyzedAt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DailySummary({ summary, analyzedAt, includedDesktop, desktop }) {
  const lastSummarized = formatAnalyzedAt(analyzedAt);
  const staleMacSummary = desktop?.available && includedDesktop !== true;

  return (
    <Card>
      <SectionHeader
        title="Summary"
        action={
          lastSummarized ? (
            <span className="text-xs text-stone-400 shrink-0">
              Last summarized · {lastSummarized}
            </span>
          ) : null
        }
      />

      {staleMacSummary && (
        <p className="text-xs text-amber-900 mb-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          This summary was generated without Mac data — Re-summarize to include your full day.
        </p>
      )}

      {summary && (
        <p className="font-serif text-base text-stone-700 leading-relaxed">{summary}</p>
      )}
    </Card>
  );
}
