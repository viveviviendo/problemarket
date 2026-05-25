import { formatUnits } from "viem";

export const categories = ["Tech", "Math", "Crypto", "Life", "Other"];
export const statuses = ["Open", "Solved", "Disputed", "Cancelled"];

export function formatUSDC(value: bigint) {
  return Number(formatUnits(value, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function timeLeft(deadline: bigint) {
  if (!deadline) return "No deadline";
  const seconds = Number(deadline) - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / 86400);
  return days ? `${days}d left` : `${Math.max(1, Math.ceil(seconds / 3600))}h left`;
}
