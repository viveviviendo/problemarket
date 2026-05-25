"use client";

import Link from "next/link";
import { formatUSDC } from "@/lib/format";
import { useProblems } from "@/hooks/useProblems";

export default function Landing() {
  const { problems } = useProblems();
  const open = problems.filter((problem) => problem.status === 0);
  const escrow = open.reduce((total, problem) => total + problem.bounty + problem.feeAmount, 0n);
  const solvers = new Set(problems.filter((problem) => problem.solver !== "0x0000000000000000000000000000000000000000").map((problem) => problem.solver)).size;

  return (
    <main>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-20 lg:grid-cols-[1.1fr_.9fr] lg:pt-28">
        <div>
          <p className="mb-6 inline-flex rounded-full border border-neon/30 bg-neon/10 px-4 py-2 text-sm text-neon">
            Non-custodial USDC escrow on Base
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight text-white sm:text-7xl">
            Resuelve problemas. <span className="text-neon">Gana crypto.</span> Sin cuentas.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
            Publica una recompensa, recibe soluciones desde cualquier wallet y libera fondos solo cuando una respuesta funciona.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link className="rounded-xl bg-neon px-6 py-4 font-medium text-ink transition hover:shadow-glow" href="/problems/new">
              Publicar problema
            </Link>
            <Link className="rounded-xl border border-line px-6 py-4 font-medium text-white transition hover:border-neon/50" href="/problems">
              Explorar bounties
            </Link>
          </div>
        </div>
        <div className="self-end rounded-3xl border border-line bg-panel/70 p-7 shadow-glow">
          <p className="text-sm uppercase tracking-[.25em] text-muted">Escrow transparente</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
            <Stat label="Problemas" value={String(problems.length)} />
            <Stat label="USDC en escrow" value={formatUSDC(escrow)} />
            <Stat label="Solvers pagados" value={String(solvers)} />
          </div>
        </div>
      </section>
      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-16 md:grid-cols-3">
          <Step number="01" title="Deposita" text="El owner deposita bounty y su fee en USDC dentro del contrato." />
          <Step number="02" title="Soluciona" text="Wallets seudónimas presentan una URI de solución verificable." />
          <Step number="03" title="Libera" text="Al aceptar, el solver cobra neto y los fees quedan visibles on-chain." />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-sm text-muted">{label}</p><p className="mt-2 text-4xl font-semibold text-white">{value}</p></div>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-2xl border border-line p-7"><p className="text-neon">{number}</p><h2 className="mt-5 text-xl text-white">{title}</h2><p className="mt-3 leading-7 text-muted">{text}</p></div>;
}
