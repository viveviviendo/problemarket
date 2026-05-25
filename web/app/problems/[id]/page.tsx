"use client";

import { FormEvent, useEffect, useState } from "react";
import { type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { IpfsBanner } from "@/components/IpfsBanner";
import { TransactionToast } from "@/components/TransactionToast";
import { useMarketActions } from "@/hooks/useMarketActions";
import { useIpfsStatus } from "@/hooks/useIpfsStatus";
import { useProblem, useSolutions } from "@/hooks/useProblems";
import { categories, formatUSDC, shortAddress, statuses, timeLeft } from "@/lib/format";
import { hasContracts, marketAddress, problemMarketAbi, type Solution } from "@/lib/contracts";
import { readStoredDocument, uploadStoredDocument } from "@/lib/ipfs";

export default function ProblemDetails({ params }: { params: { id: string } }) {
  const id = BigInt(params.id);
  const { address, isConnected } = useAccount();
  const { data: problem, refetch } = useProblem(id);
  const isOwner = Boolean(address && problem && address.toLowerCase() === problem.owner.toLowerCase());
  const { data: solutions } = useSolutions(id, isOwner);
  const solverFeeQuery = useReadContract({ address: marketAddress, abi: problemMarketAbi, functionName: "reservedSolverFee", args: [id], query: { enabled: hasContracts } });
  const ownerPercentQuery = useReadContract({ address: marketAddress, abi: problemMarketAbi, functionName: "reservedOwnerFeePercent", args: [id], query: { enabled: hasContracts } });
  const solverPercentQuery = useReadContract({ address: marketAddress, abi: problemMarketAbi, functionName: "reservedSolverFeePercent", args: [id], query: { enabled: hasContracts } });
  const solverFee = (solverFeeQuery.data as bigint | undefined) ?? 0n;
  const ownerPercent = ownerPercentQuery.data as bigint | undefined;
  const solverPercent = solverPercentQuery.data as bigint | undefined;
  const { submitSolution, acceptSolution, cancelProblem, transaction } = useMarketActions();
  const ipfsStatus = useIpfsStatus();
  const [description, setDescription] = useState("");
  const [solution, setSolution] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [selected, setSelected] = useState<Solution>();

  useEffect(() => {
    if (!problem?.descriptionURI) return;
    readStoredDocument(problem.descriptionURI)
      .then((body) => setDescription(body.description || problem.descriptionURI))
      .catch(() => setDescription(problem.descriptionURI));
  }, [problem?.descriptionURI]);

  if (!problem) return <main className="mx-auto max-w-5xl px-5 py-16 text-muted">Leyendo problema desde la red...</main>;

  async function sendSolution(event: FormEvent) {
    event.preventDefault();
    setUploadError("");
    let uploaded: { uri: string };
    try {
      uploaded = await uploadStoredDocument({ kind: "solution", solution: solution.trim(), notes: notes.trim() });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo guardar la solución.");
      return;
    }
    await submitSolution(id, uploaded.uri);
    setSolution("");
    setNotes("");
    await refetch();
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_330px]">
      <section className="rounded-3xl border border-line bg-panel p-7 sm:p-10">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-neon/10 px-3 py-1 text-neon">{categories[problem.category]}</span>
          <span className="text-muted">{statuses[problem.status]}</span>
          <span className="text-muted">{timeLeft(problem.deadline)}</span>
        </div>
        <h1 className="mt-7 text-4xl font-semibold text-white">{problem.title}</h1>
        <p className="mt-4 font-mono text-xs text-muted">Owner {shortAddress(problem.owner)}</p>
        <div className="mt-9 whitespace-pre-wrap border-t border-line pt-8 leading-8 text-[#d5e1dc]">{description || "Cargando descripción IPFS..."}</div>

        {problem.status === 0 && isConnected && !isOwner && (
          <form className="mt-10 border-t border-line pt-8" onSubmit={sendSolution}>
            <h2 className="text-xl text-white">Enviar solución</h2>
            <IpfsBanner status={ipfsStatus} />
            <label className="mt-5 block text-sm text-muted">Solución
              <textarea required className="mt-2 w-full rounded-xl border border-line bg-ink p-4 text-white" rows={5} value={solution} onChange={(event) => setSolution(event.target.value)} />
            </label>
            <label className="mt-4 block text-sm text-muted">Notas para el solicitante (opcional)
              <textarea maxLength={500} className="mt-2 w-full rounded-xl border border-line bg-ink p-4 text-white" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <p className="mt-2 text-xs text-danger">Esta información se almacena en IPFS y es pública. No incluyas datos personales.</p>
            {uploadError && <p className="mt-4 rounded-lg border border-danger/50 bg-danger/10 p-3 text-sm text-danger">{uploadError}</p>}
            <button disabled={Boolean(ipfsStatus && !ipfsStatus.configured && !ipfsStatus.devMode)} className="mt-4 rounded-xl bg-neon px-6 py-3 font-medium text-ink disabled:opacity-40">Enviar propuesta</button>
          </form>
        )}

        {isOwner && problem.status === 0 && (
          <div className="mt-10 border-t border-line pt-8">
            <h2 className="text-xl text-white">Propuestas recibidas</h2>
            <p className="mt-2 text-sm text-muted">Solo se muestran en esta interfaz al owner. Las URIs on-chain son públicas.</p>
            <div className="mt-5 space-y-4">
              {solutions?.length === 0 && <p className="text-muted">Todavía no hay soluciones.</p>}
              {solutions?.map((entry) => <Proposal key={entry.solver} proposal={entry} onAccept={() => setSelected(entry)} />)}
            </div>
          </div>
        )}
      </section>
      <aside className="h-fit rounded-2xl border border-line bg-panel p-6">
        <p className="text-xs uppercase tracking-widest text-muted">Escrow</p>
        <p className="mt-4 text-4xl font-semibold text-white">{formatUSDC(problem.bounty)} <small className="text-sm text-neon">USDC</small></p>
        <div className="mt-7"><FeeBreakdown compact bounty={problem.bounty} ownerFee={problem.feeAmount} solverFee={solverFee} ownerPercent={ownerPercent} solverPercent={solverPercent} /></div>
        {isOwner && problem.status === 0 && (
          <button onClick={async () => { await cancelProblem(id); await refetch(); }} className="mt-5 w-full rounded-xl border border-danger/40 px-4 py-3 text-sm text-danger">
            Cancelar y solicitar devolución
          </button>
        )}
      </aside>
      {selected && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-5">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6">
            <h2 className="text-xl text-white">Confirmar pago</h2>
            <p className="my-4 text-sm text-muted">Vas a aceptar la propuesta de {shortAddress(selected.solver)}. Revisa el pago antes de firmar.</p>
            <FeeBreakdown bounty={problem.bounty} ownerFee={problem.feeAmount} solverFee={solverFee} ownerPercent={ownerPercent} solverPercent={solverPercent} />
            <div className="mt-5 flex gap-3">
              <button onClick={() => setSelected(undefined)} className="flex-1 rounded-xl border border-line p-3 text-muted">Volver</button>
              <button onClick={async () => { await acceptSolution(id, selected.solver as Address); setSelected(undefined); await refetch(); }} className="flex-1 rounded-xl bg-neon p-3 font-medium text-ink">Firmar y pagar</button>
            </div>
          </div>
        </div>
      )}
      <TransactionToast transaction={transaction} />
    </main>
  );
}

function Proposal({ proposal, onAccept }: { proposal: Solution; onAccept: () => void }) {
  const [content, setContent] = useState<Record<string, string>>();
  useEffect(() => {
    readStoredDocument(proposal.solutionURI).then(setContent).catch(() => setContent({ solution: proposal.solutionURI }));
  }, [proposal.solutionURI]);
  return (
    <div className="rounded-xl border border-line bg-ink p-4">
      <p className="font-mono text-sm text-muted">{shortAddress(proposal.solver)}</p>
      <p className="my-3 whitespace-pre-wrap text-sm">{content?.solution || "Cargando propuesta..."}</p>
      {content?.notes && <p className="mb-4 rounded-lg border border-line p-3 text-sm text-muted">Notas: {content.notes}</p>}
      <button onClick={onAccept} className="rounded-lg bg-neon px-4 py-2 text-sm font-medium text-ink">Revisar pago y aceptar</button>
    </div>
  );
}
