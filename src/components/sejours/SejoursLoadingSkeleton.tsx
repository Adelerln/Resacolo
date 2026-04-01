export function SejoursLoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      <div className="space-y-4">
        <div className="h-12 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
