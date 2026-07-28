export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${subtitle || action ? "mb-4" : "mb-0"}`}>
      <div>
        <h2 className="font-serif text-lg font-medium text-stone-900">{title}</h2>
        {subtitle && <p className="text-sm text-stone-500 leading-snug mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
