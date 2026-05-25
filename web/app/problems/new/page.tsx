"use client";

import { FormEvent, useMemo, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { TransactionToast } from "@/components/TransactionToast";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { IpfsBanner } from "@/components/IpfsBanner";
import { useMarketActions } from "@/hooks/useMarketActions";
import { useIpfsStatus } from "@/hooks/useIpfsStatus";
import { usePlatformConfig } from "@/hooks/useProblems";
import { categories } from "@/lib/format";
import { hasContracts, marketAddress, problemMarketAbi } from "@/lib/contracts";
import { uploadStoredDocument } from "@/lib/ipfs";

export default function NewProblemPage() {
  const { isConnected } = useAccount();
  const { createProblem, transaction } = useMarketActions();
  const ipfsStatus = useIpfsStatus();
  const { data: config } = usePlatformConfig();
  const [form, setForm] = useState({ title: "", description: "", bounty: "10", category: 0, deadline: "" });
  const [uploadError, setUploadError] = useState("");
  const bounty = useMemo(() => {
    try { return parseUnits(form.bounty, 6); } catch { return 0n; }
  }, [form.bounty]);
  const { data: feeResult } = useReadContract({
    address: marketAddress,
    abi: problemMarketAbi,
    functionName: "calculateFees",
    args: [bounty],
    query: { enabled: hasContracts && bounty >= 1_000_000n && bounty <= 100_000_000n }
  });
  const fees = feeResult as readonly [bigint, bigint] | undefined;
  const ownerFee = fees?.[0] ?? 0n;
  const solverFee = fees?.[1] ?? 0n;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setUploadError("");
    let uploaded: { uri: string };
    try {
      uploaded = await uploadStoredDocument({ kind: "problem", title: form.title.trim(), description: form.description.trim() });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo guardar la descripción.");
      return;
    }
    await createProblem({
      title: form.title,
      descriptionURI: uploaded.uri,
      bounty: form.bounty,
      category: form.category,
      deadline: form.deadline ? Math.floor(new Date(form.deadline).getTime() / 1000) : 0,
      ownerFee
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm uppercase tracking-[.25em] text-neon">Crear bounty</p>
      <h1 className="mt-4 text-4xl font-semibold text-white">Publicar problema</h1>
      <form className="mt-10 space-y-6 rounded-3xl border border-line bg-panel p-6 sm:p-9" onSubmit={submit}>
        <IpfsBanner status={ipfsStatus} />
        <Input label="Título">
          <input required maxLength={120} className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Auditar vulnerabilidad de smart contract" />
        </Input>
        <Input label="Descripción (se publica vía IPFS)">
          <textarea required rows={6} className="input resize-none" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe entregables y criterios de aceptación..." />
        </Input>
        <div className="grid gap-5 sm:grid-cols-3">
          <Input label="Bounty (USDC)">
            <input required type="number" min="1" max="100" step="0.01" className="input" value={form.bounty} onChange={(event) => setForm({ ...form, bounty: event.target.value })} />
          </Input>
          <Input label="Categoría">
            <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: Number(event.target.value) })}>
              {categories.map((category, index) => <option value={index} key={category}>{category}</option>)}
            </select>
          </Input>
          <Input label="Deadline opcional">
            <input type="datetime-local" className="input" value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} />
          </Input>
        </div>
        <FeeBreakdown bounty={bounty} ownerFee={ownerFee} solverFee={solverFee} ownerPercent={config?.[0]} solverPercent={config?.[1]} />
        {uploadError && <p className="rounded-lg border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{uploadError}</p>}
        <button disabled={!isConnected || !fees || transaction.kind === "pending" || (ipfsStatus ? !ipfsStatus.configured && !ipfsStatus.devMode : true)} className="w-full rounded-xl bg-neon p-4 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40">
          {!isConnected ? "Conecta tu wallet para publicar" : "Aprobar USDC y publicar"}
        </button>
        {!hasContracts && <p className="text-center text-xs text-danger">Configura las direcciones de contratos en `.env.local` para leer fees y enviar transacciones.</p>}
      </form>
      <TransactionToast transaction={transaction} />
      <style jsx>{`.input { width: 100%; border: 1px solid #1d2925; border-radius: .7rem; background: #090c0b; padding: .8rem; color: white; }`}</style>
    </main>
  );
}

function Input({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm text-muted">{label}</span>{children}</label>;
}
