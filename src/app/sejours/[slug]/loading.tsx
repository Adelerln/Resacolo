export default function StayDetailLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="h-[240px] animate-pulse bg-slate-200 sm:h-[300px] md:h-[360px]" />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
          <div className="space-y-6">
            <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
            <div className="h-12 w-full animate-pulse rounded-lg bg-slate-100" />
            <div className="h-40 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
