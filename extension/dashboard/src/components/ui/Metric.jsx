export function Metric({ children, muted = false, className = "" }) {
  return (
    <span
      className={`tabular-nums font-semibold ${
        muted ? "text-stone-500 font-medium" : "text-amber-800"
      } ${className}`}
    >
      {children}
    </span>
  );
}
