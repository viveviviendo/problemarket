"use client";

import { useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { BountyCard } from "@/components/BountyCard";
import { ProblemSkeleton } from "@/components/ProblemSkeleton";
import { useProblems } from "@/hooks/useProblems";
import { formatUSDC } from "@/lib/format";
import { marketAddress, problemMarketAbi } from "@/lib/contracts";

export default function Dashboard() {
  const [tab, setTab] = useState<"created" | "submitted">("created");
  const { address } = useAccount();
  const { problems, isLoading } = useProblems();
  const submittedQuery = useReadContracts({
    contracts: address ? problems.map((problem) => ({
      address: marketAddress,
      abi: problemMarketAbi,
      functionName: "hasSubmittedSolution" as const,
      args: [problem.id, address] as const
    })) : [],
    query: { enabled: Boolean(address && problems.length) }
  });
  const mine = useMemo(() => problems.filter((problem) => address && problem.owner.toLowerCase() === address.toLowerCase()), [address, problems]);
  const submitted = problems.filter((_, index) => submittedQuery.data?.[index]?.result === true);
  const won = submitted.filter((problem) => address && problem.solver.toLowerCase() === address.toLowerCase());
  const earned = won.reduce((total, problem) => total + problem.bounty, 0n);
  const spent = mine.filter((problem) => problem.status === 1).reduce((total, problem) => total + problem.bounty + problem.feeAmount, 0n);
  const list = tab === "created" ? mine : submitted;

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <p className="text-sm uppercase tracking-[.25em] text-neon">Tu wallet</p>
      <h1 className="mt-4 text-4xl font-semibold text-white">Dashboard</h1>
      {!address && <p className="mt-10 rounded-2xl border border-line bg-panel p-10 text-muted">Conecta una wallet para ver tu actividad.</p>}
      {address && (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-4">
            <Stat label="Creados" value={String(mine.length)} />
            <Stat label="Soluciones" value={String(submitted.length)} />
            <Stat label="USDC ganado bruto" value={formatUSDC(earned)} />
            <Stat label="USDC gastado" value={formatUSDC(spent)} />
          </div>
          <div className="mt-12 flex gap-2 border-b border-line pb-4">
            <Tab active={tab === "created"} onClick={() => setTab("created")}>Mis Problemas</Tab>
            <Tab active={tab === "submitted"} onClick={() => setTab("submitted")}>Mis Soluciones</Tab>
          </div>
          <div className="mt-7 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {isLoading && Array.from({ length: 3 }).map((_, index) => <ProblemSkeleton key={index} />)}
            {list.map((problem) => <BountyCard key={problem.id.toString()} problem={problem} />)}
            {!isLoading && list.length === 0 && (
              <div className="col-span-full rounded-2xl border border-line bg-panel p-10 text-center text-muted">
                {tab === "created" ? "Aún no has creado problemas." : "Aún no has enviado soluciones."}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-panel p-5"><p className="text-sm text-muted">{label}</p><p className="mt-3 text-3xl text-white">{value}</p></div>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-lg px-5 py-3 text-sm ${active ? "bg-neon text-ink" : "text-muted"}`}>{children}</button>;
}
