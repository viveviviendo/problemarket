"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { base, baseSepolia, polygon } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "ProblemMarket",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [baseSepolia, base, polygon],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [base.id]: http(),
    [polygon.id]: http()
  },
  ssr: true
});
