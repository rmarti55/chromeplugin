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
            <span className="text-sm text-stone-600 shrink-0">
              Last summarized · {lastSummarized}
            </span>
          ) : null
        }
      />

      {staleMacSummary && (
        <p className="text-sm text-accent-dark mb-4 p-2.5 rounded-lg bg-accent-soft border border-accent/30">
          This summary was generated without Mac data — Re-summarize to include your full day.
        </p>
      )}

      {summary && (
        <p className="font-serif text-base text-stone-800 leading-relaxed">{summary}</p>
      )}
    </Card>
  );
}
