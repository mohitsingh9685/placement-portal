export default function ResetFiltersButton({ onClick, className = "", label = "Reset filters" }) {
  return <button type="button" aria-label={label} onClick={onClick} className={`rounded-xl border border-cyan-400/30 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${className}`}>Reset</button>;
}
