"use client";

import Link from "next/link";
import { BountyCard } from "@/components/BountyCard";
import { ProblemSkeleton } from "@/components/ProblemSkeleton";
import { useProblems } from "@/hooks/useProblems";
import { categories } from "@/lib/format";
import { useFilterStore } from "@/lib/store";

export default function ProblemsPage() {
  const { problems, isLoading } = useProblems();
  const filter = useFilterStore();
  const shown = problems
    .filter((problem) => problem.title.toLowerCase().includes(filter.search.toLowerCase()))
    .filter((problem) => filter.category === "All" || categories[problem.category] === filter.category)
    .filter((problem) => filter.status === "All" || problem.status === (filter.status === "Open" ? 0 : 1))
    .filter((problem) => Number(problem.bounty / 1_000_000n) >= filter.min && Number(problem.bounty / 1_000_000n) <= filter.max)
    .sort((a, b) => {
      if (filter.sort === "bounty") return Number(b.bounty - a.bounty);
      if (filter.sort === "deadline") return Number((a.deadline || 2n ** 255n) - (b.deadline || 2n ** 255n));
      return Number(b.createdAt - a.createdAt);
    });

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <div className="mb-10">
        <p className="text-sm uppercase tracking-[.25em] text-neon">Marketplace</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Problemas financiados</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[270px_1fr]">
        <aside className="h-fit space-y-7 rounded-2xl border border-line bg-panel p-5">
          <Field label="Buscar">
            <input className="w-full rounded-lg border border-line bg-ink p-3 text-sm" placeholder="Título..." value={filter.search} onChange={(event) => filter.set({ search: event.target.value })} />
          </Field>
          <Field label="Categoría">
            <select className="w-full rounded-lg border border-line bg-ink p-3" value={filter.category} onChange={(event) => filter.set({ category: event.target.value })}>
              {["All", ...categories].map((category) => <option key={category}>{category}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <div className="flex gap-2">{["Open", "Solved", "All"].map((status) => <button key={status} className={`rounded-lg px-3 py-2 text-sm ${filter.status === status ? "bg-neon text-ink" : "bg-ink text-muted"}`} onClick={() => filter.set({ status })}>{status}</button>)}</div>
          </Field>
          <Field label={`Bounty: ${filter.min} - ${filter.max} USDC`}>
            <input className="w-full accent-[#00ff88]" type="range" min="1" max="100" value={filter.max} onChange={(event) => filter.set({ max: Number(event.target.value) })} />
          </Field>
          <Field label="Ordenar">
            <select className="w-full rounded-lg border border-line bg-ink p-3" value={filter.sort} onChange={(event) => filter.set({ sort: event.target.value })}>
              <option value="recent">Más reciente</option><option value="bounty">Mayor bounty</option><option value="deadline">Menos tiempo</option>
            </select>
          </Field>
        </aside>
        <section>
          {isLoading && <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <ProblemSkeleton key={index} />)}</div>}
          {!isLoading && shown.length === 0 && (
            <div className="rounded-2xl border border-line bg-panel p-10 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-neon/30 bg-neon/10 text-3xl text-neon">?</div>
              <h2 className="mt-5 text-xl text-white">Sé el primero en publicar un problema</h2>
              <p className="mx-auto mt-3 max-w-sm text-muted">Financia una pregunta y abre la puerta a soluciones de cualquier wallet.</p>
              <Link className="mt-7 inline-block rounded-xl bg-neon px-6 py-3 font-medium text-ink" href="/problems/new">Crear problema</Link>
            </div>
          )}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map((problem) => <BountyCard key={problem.id.toString()} problem={problem} />)}</div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-3 block text-xs uppercase tracking-widest text-muted">{label}</span>{children}</label>;
}
