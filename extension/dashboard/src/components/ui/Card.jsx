export function Card({ children, className = "", dashed = false }) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 shadow-card border ${
        dashed ? "border-dashed border-stone-300" : "border-stone-200"
      } ${className}`}
    >
      {children}
    </div>
  );
}
