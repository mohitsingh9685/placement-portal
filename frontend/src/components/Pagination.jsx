export default function Pagination({ data, page, onPage, loading, label = "results", compact = false, nextLabel = "Next" }) {
  const pages = data?.pages || 1, total = data?.total ?? 0, limit = data?.limit || 20;
  const button = `rounded-lg border border-white/15 disabled:opacity-40 ${compact ? "px-2.5 py-1.5" : "px-3 py-2"}`;
  return <nav aria-label={`${label} pages`} className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "mt-3 text-xs" : "mt-5 text-sm"}`}>
    <p aria-live="polite" className="text-slate-400">{loading ? "Loading…" : `${total ? Math.min((page - 1) * limit + 1, total) : 0}–${Math.min(page * limit, total)} of ${total} ${label}`}</p>
    <div className="flex items-center gap-3"><button disabled={loading || page <= 1} onClick={() => onPage(page > pages ? 1 : page - 1)} className={button}>Previous</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => onPage(page + 1)} className={button}>{nextLabel}</button></div>
  </nav>;
}
