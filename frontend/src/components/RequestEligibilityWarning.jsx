export default function RequestEligibilityWarning({ warnings }) {
  if (!warnings?.length) return null;
  return <div className="my-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
    <p className="font-semibold">Corrected details need eligibility review</p>
    <p className="mt-1">When this request was sent, the corrected details did not meet these role requirements:</p>
    <ul className="mt-2 list-inside list-disc space-y-1">{warnings.map(message => <li key={message}>{message}</li>)}</ul>
    <p className="mt-2">Approving the correction updates the recorded details. Selection or rejection remains a separate placement-team decision.</p>
  </div>;
}
