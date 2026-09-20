export default function SessionStatus({ error, retry }) {
  return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100" role="status">
    <p>{error || "Checking your session…"}</p>
    {error && <button className="rounded-lg bg-blue-600 px-5 py-2" onClick={retry}>Try again</button>}
  </div>;
}
