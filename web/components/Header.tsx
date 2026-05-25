"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi, hasContracts, usdcAddress } from "@/lib/contracts";
import { formatUSDC } from "@/lib/format";

export function Header() {
  const { address } = useAccount();
  const { data: balance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContracts) }
  });

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link className="text-xl font-semibold tracking-tight text-white" href="/">
          Problem<span className="text-neon">Market</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <Link className="transition hover:text-white" href="/problems">Marketplace</Link>
          <Link className="transition hover:text-white" href="/problems/new">Crear</Link>
          <Link className="transition hover:text-white" href="/dashboard">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-3">
          {typeof balance === "bigint" && (
            <span className="hidden rounded-full border border-line px-3 py-2 text-xs text-neon sm:inline">
              {formatUSDC(balance)} USDC
            </span>
          )}
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
        </div>
      </div>
    </header>
  );
}
