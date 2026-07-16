// OpenRouter model for Daily Mirror summaries (single model, no picker).

export const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export const MODEL_LABEL = "Gemini 2.5 Flash Lite";

/** List price on OpenRouter (USD per 1M tokens). */
export const MODEL_INPUT_PER_M = 0.1;
export const MODEL_OUTPUT_PER_M = 0.4;

/** Rough USD estimate from OpenRouter usage object. */
export function estimateCostUsd(usage) {
  if (!usage) return null;
  const input = usage.prompt_tokens || 0;
  const output = usage.completion_tokens || 0;
  return (input * MODEL_INPUT_PER_M + output * MODEL_OUTPUT_PER_M) / 1_000_000;
}
