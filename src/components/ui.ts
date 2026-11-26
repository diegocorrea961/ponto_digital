// Classes reaproveitadas nos formulários e botões.
export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:bg-slate-100";

export const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btnBase} bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-600`;
export const btnSecondary = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400`;
export const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`;
