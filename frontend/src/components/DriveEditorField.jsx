export const editorInput = "mt-1 block w-full min-w-0 rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 disabled:opacity-50";
export const editorButton = "rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
export default function DriveEditorField({ label, field, value, onChange, options, multiline, className = "", controlClassName = "", ...props }) {
  const shared = { className: `${editorInput} ${controlClassName}`, "data-editor-field": field, value: value ?? "", onChange: event => onChange(event.target.value), ...props };
  return <label className={`block min-w-0 text-xs font-medium text-slate-400 ${className}`}>{label}{options ? <select {...shared}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : multiline ? <textarea rows={4} maxLength={20000} {...shared} /> : <input {...shared} />}</label>;
}
