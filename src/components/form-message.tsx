export type FormState = { error?: string; success?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${
        isError
          ? "bg-red-50 text-red-800 ring-1 ring-red-200"
          : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
      }`}
    >
      {state.error ?? state.success}
    </p>
  );
}
