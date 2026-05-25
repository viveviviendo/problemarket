export function ProblemSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-line bg-panel p-5">
      <div className="h-7 w-20 rounded-full bg-line" />
      <div className="mt-6 h-5 w-4/5 rounded bg-line" />
      <div className="mt-3 h-5 w-2/3 rounded bg-line" />
      <div className="mt-9 flex justify-between">
        <div className="h-8 w-24 rounded bg-line" />
        <div className="h-5 w-16 rounded bg-line" />
      </div>
    </div>
  );
}
