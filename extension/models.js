// OpenRouter model presets — shared by ai.js and the dashboard Settings UI.
// Use paid listed models only (avoid :free promo tiers).

export const MODEL_PRESETS = {
  budget: {
    id: "budget",
    label: "Budget",
    slug: "qwen/qwen3.5-flash-02-23",
    description: "Qwen 3.5 Flash — lowest cost (~$0.065/$0.26 per 1M tokens)",
    costHint: "~$0.0005 per summary",
    inputPerM: 0.065,
    outputPerM: 0.26,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    slug: "google/gemini-2.5-flash-lite",
    description: "Gemini 2.5 Flash Lite — fast, stable default (~$0.10/$0.40 per 1M)",
    costHint: "~$0.001 per summary",
    inputPerM: 0.1,
    outputPerM: 0.4,
  },
  premium: {
    id: "premium",
    label: "Premium",
    slug: "anthropic/claude-sonnet-4.5",
    description: "Claude Sonnet 4.5 — best narrative quality (~$3/$15 per 1M)",
    costHint: "~$0.03 per summary",
    inputPerM: 3,
    outputPerM: 15,
  },
};

export const DEFAULT_PRESET = "balanced";
export const DEFAULT_MODEL = MODEL_PRESETS.balanced.slug;

/** Resolve slug from chrome.storage settings shape. */
export function resolveModelSlug(settings = {}) {
  const preset = settings.modelPreset;
  if (preset && preset !== "custom" && MODEL_PRESETS[preset]) {
    return MODEL_PRESETS[preset].slug;
  }
  if (settings.model && settings.model.trim()) {
    return settings.model.trim();
  }
  return DEFAULT_MODEL;
}

/** Rough USD estimate from OpenRouter usage object. */
export function estimateCostUsd(usage, slug) {
  if (!usage) return null;
  const preset = Object.values(MODEL_PRESETS).find((p) => p.slug === slug);
  const inputPerM = preset?.inputPerM ?? 0.1;
  const outputPerM = preset?.outputPerM ?? 0.4;
  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  return (input * inputPerM + output * outputPerM) / 1_000_000;
}
