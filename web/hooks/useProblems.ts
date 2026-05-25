"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { hasContracts, marketAddress, problemMarketAbi, type PlatformConfig, type Problem, type Solution } from "@/lib/contracts";

export function useProblems() {
  const countQuery = useReadContract({
    address: marketAddress,
    abi: problemMarketAbi,
    functionName: "problemCount",
    query: { enabled: hasContracts }
  });
  const count = Number((countQuery.data as bigint | undefined) || 0n);
  const contracts = Array.from({ length: count }, (_, index) => ({
    address: marketAddress,
    abi: problemMarketAbi,
    functionName: "getProblem" as const,
    args: [BigInt(index + 1)] as const
  }));
  const query = useReadContracts({
    contracts,
    query: { enabled: hasContracts && count > 0 }
  });
  const problems = (query.data || [])
    .map((entry) => entry.result as Problem | undefined)
    .filter((problem): problem is Problem => Boolean(problem));
  return { problems, isLoading: countQuery.isLoading || query.isLoading, refetch: query.refetch };
}

export function useProblem(id: bigint) {
  const query = useReadContract({
    address: marketAddress,
    abi: problemMarketAbi,
    functionName: "getProblem",
    args: [id],
    query: { enabled: hasContracts && id > 0n }
  });
  return { ...query, data: query.data as Problem | undefined };
}

export function useSolutions(id: bigint, enabled: boolean) {
  const query = useReadContract({
    address: marketAddress,
    abi: problemMarketAbi,
    functionName: "getSolutions",
    args: [id],
    query: { enabled: hasContracts && id > 0n && enabled }
  });
  return { ...query, data: query.data as readonly Solution[] | undefined };
}

export function usePlatformConfig() {
  const query = useReadContract({
    address: marketAddress,
    abi: problemMarketAbi,
    functionName: "config",
    query: { enabled: hasContracts }
  });
  return { ...query, data: query.data as PlatformConfig | undefined };
}
