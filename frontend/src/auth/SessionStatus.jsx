export default function SessionStatus() {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-slate-950 px-4 text-slate-100" role="status" aria-label="Loading Placement Portal">
    <span aria-hidden="true" className="h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400 motion-reduce:animate-none" />
    <p className="text-lg font-semibold tracking-tight">Placement Portal</p>
    <span className="sr-only">Loading…</span>
  </main>;
}
