export default function Pagination({ data, page, onPage, loading, label = "results" }) {
  const pages = data?.pages || 1, total = data?.total ?? 0, limit = data?.limit || 20;
  return <nav aria-label={`${label} pages`} className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
    <p aria-live="polite" className="text-slate-400">{loading ? "Loading…" : `${total ? Math.min((page - 1) * limit + 1, total) : 0}–${Math.min(page * limit, total)} of ${total} ${label}`}</p>
    <div className="flex items-center gap-3"><button disabled={loading || page <= 1} onClick={() => onPage(page > pages ? 1 : page - 1)} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={loading || page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-white/15 px-3 py-2 disabled:opacity-40">Next</button></div>
  </nav>;
}
