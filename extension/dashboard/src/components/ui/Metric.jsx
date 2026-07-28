export function Metric({ children, muted = false, className = "" }) {
  return (
    <span
      className={`tabular-nums font-semibold ${
        muted ? "text-stone-700 font-medium" : "text-accent-dark"
      } ${className}`}
    >
      {children}
    </span>
  );
}
