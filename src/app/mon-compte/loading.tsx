export default function MonCompteLoading() {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-6 h-4 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      </div>
    </div>
  );
}
