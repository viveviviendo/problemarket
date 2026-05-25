import { useChainId } from "wagmi";
import type { TransactionState } from "@/hooks/useMarketActions";

export function TransactionToast({ transaction }: { transaction: TransactionState }) {
  const chainId = useChainId();
  if (transaction.kind === "idle") return null;
  const color = transaction.kind === "error" ? "border-danger text-danger" : "border-neon/40 text-neon";
  const explorer = chainId === 84532 ? "https://sepolia.basescan.org/tx/" : chainId === 8453 ? "https://basescan.org/tx/" : "https://polygonscan.com/tx/";
  return (
    <div className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border bg-panel p-4 text-sm shadow-glow ${color}`}>
      <p className="flex items-center gap-2">
        {transaction.kind === "pending" && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neon border-t-transparent" />}
        {transaction.kind === "success" && <span aria-hidden>✓</span>}
        {transaction.kind === "error" && <span aria-hidden>×</span>}
        {transaction.message}
      </p>
      {transaction.hash && (
        <a className="mt-2 block font-mono text-xs underline opacity-80" href={`${explorer}${transaction.hash}`} target="_blank" rel="noreferrer">
          {transaction.hash.slice(0, 18)}... ver explorer
        </a>
      )}
    </div>
  );
}
