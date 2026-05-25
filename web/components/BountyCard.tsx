import Link from "next/link";
import type { Problem } from "@/lib/contracts";
import { categories, formatUSDC, statuses, timeLeft } from "@/lib/format";

export function BountyCard({ problem }: { problem: Problem }) {
  return (
    <Link
      href={`/problems/${problem.id}`}
      className="group rounded-2xl border border-line bg-panel p-5 transition hover:-translate-y-1 hover:border-neon/40 hover:shadow-glow"
    >
      <div className="flex justify-between gap-3">
        <span className="rounded-full border border-neon/20 bg-neon/10 px-3 py-1 text-xs text-neon">
          {categories[problem.category]}
        </span>
        <span className="text-xs text-muted">{statuses[problem.status]}</span>
      </div>
      <h3 className="mt-5 min-h-12 text-lg font-medium text-white group-hover:text-neon">{problem.title}</h3>
      <div className="mt-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">Bounty</p>
          <p className="mt-1 text-2xl font-semibold text-white">{formatUSDC(problem.bounty)} <small className="text-sm text-neon">USDC</small></p>
        </div>
        <p className="text-sm text-muted">{timeLeft(problem.deadline)}</p>
      </div>
    </Link>
  );
}
