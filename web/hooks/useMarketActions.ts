"use client";

import { useState } from "react";
import { type Address, type Hex, parseUnits } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi, marketAddress, problemMarketAbi, usdcAddress } from "@/lib/contracts";

export type TransactionState = { message: string; hash?: Hex; kind: "idle" | "pending" | "success" | "error" };

function readableError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  const messages: Record<string, string> = {
    InvalidBounty: "El bounty debe estar dentro del rango permitido.",
    TooManyActiveProblems: "Has alcanzado el límite de problemas activos.",
    InvalidDeadline: "El deadline ya ha vencido o no es válido.",
    NotProblemOwner: "Solo el solicitante puede realizar esta acción.",
    CannotCancelWithActiveSolutions: "No puedes cancelar mientras hay propuestas activas antes del deadline.",
    OwnerCannotSolve: "No puedes enviar una solución a tu propio problema.",
    AlreadySubmitted: "Ya enviaste una solución para este problema.",
    InvalidStatus: "El problema ya no está abierto."
  };
  const match = Object.keys(messages).find((name) => text.includes(name));
  return match ? messages[match] : "La transacción falló o fue rechazada en la wallet.";
}

export function useMarketActions() {
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [transaction, setTransaction] = useState<TransactionState>({ message: "", kind: "idle" });

  async function confirmed(hash: Hex) {
    await client!.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function createProblem(values: {
    title: string;
    descriptionURI: string;
    bounty: string;
    category: number;
    deadline: number;
    ownerFee: bigint;
  }) {
    try {
      const bounty = parseUnits(values.bounty, 6);
      setTransaction({ kind: "pending", message: "Approving USDC deposit..." });
      const approval = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [marketAddress, bounty + values.ownerFee]
      });
      setTransaction({ kind: "pending", message: "Esperando confirmación de aprobación...", hash: approval });
      await confirmed(approval);
      setTransaction({ kind: "pending", message: "Publishing problem to escrow..." });
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: problemMarketAbi,
        functionName: "createProblem",
        args: [values.title, values.descriptionURI, bounty, values.category, BigInt(values.deadline)]
      });
      setTransaction({ kind: "pending", message: "Esperando confirmación de publicación...", hash });
      await confirmed(hash);
      setTransaction({ kind: "success", message: "Problema financiado y publicado.", hash });
      return hash;
    } catch (error) {
      setTransaction({ kind: "error", message: readableError(error) });
      throw error;
    }
  }

  async function submitSolution(problemId: bigint, solutionURI: string) {
    try {
      setTransaction({ kind: "pending", message: "Submitting solution URI..." });
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: problemMarketAbi,
        functionName: "submitSolution",
        args: [problemId, solutionURI]
      });
      setTransaction({ kind: "pending", message: "Esperando confirmación de la propuesta...", hash });
      await confirmed(hash);
      setTransaction({ kind: "success", message: "Solución enviada y confirmada.", hash });
    } catch (error) {
      setTransaction({ kind: "error", message: readableError(error) });
    }
  }

  async function acceptSolution(problemId: bigint, solver: Address) {
    try {
      setTransaction({ kind: "pending", message: "Releasing escrow payment..." });
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: problemMarketAbi,
        functionName: "acceptSolution",
        args: [problemId, solver]
      });
      setTransaction({ kind: "pending", message: "Esperando confirmación del pago...", hash });
      await confirmed(hash);
      setTransaction({ kind: "success", message: "Pago liberado y confirmado.", hash });
    } catch (error) {
      setTransaction({ kind: "error", message: readableError(error) });
    }
  }

  async function cancelProblem(problemId: bigint) {
    try {
      setTransaction({ kind: "pending", message: "Solicitando devolución del escrow..." });
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: problemMarketAbi,
        functionName: "cancelProblem",
        args: [problemId]
      });
      setTransaction({ kind: "pending", message: "Esperando confirmación de la devolución...", hash });
      await confirmed(hash);
      setTransaction({ kind: "success", message: "Problema cancelado y escrow devuelto.", hash });
    } catch (error) {
      setTransaction({ kind: "error", message: readableError(error) });
    }
  }

  return { transaction, createProblem, submitSolution, acceptSolution, cancelProblem };
}
