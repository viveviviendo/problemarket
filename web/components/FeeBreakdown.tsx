import { formatUSDC } from "@/lib/format";

type Props = {
  bounty: bigint;
  ownerFee: bigint;
  solverFee: bigint;
  ownerPercent?: bigint;
  solverPercent?: bigint;
  compact?: boolean;
};

function percent(value?: bigint) {
  return value === undefined ? "" : `${Number(value) / 100}%`;
}

function feeLabel(fee: bigint, bounty: bigint, rate?: bigint) {
  if (rate === undefined) return "";
  const calculated = bounty * rate / 10_000n;
  return fee > calculated ? `mínimo aplicado; ${percent(rate)} base` : percent(rate);
}

export function FeeBreakdown({ bounty, ownerFee, solverFee, ownerPercent, solverPercent, compact }: Props) {
  const solverNet = bounty > solverFee ? bounty - solverFee : 0n;
  return (
    <div className={`rounded-xl border border-neon/20 bg-neon/[.04] ${compact ? "p-4" : "p-5"} text-sm`}>
      <Line label="Bounty" value={bounty} />
      <Line label="Fee plataforma (owner)" value={ownerFee} note={feeLabel(ownerFee, bounty, ownerPercent)} />
      <div className="my-3 border-t border-line" />
      <Line label="Total a depositar" value={bounty + ownerFee} strong />
      <div className="my-3 border-t border-line" />
      <Line label="Solver recibirá" value={solverNet} strong />
      <Line label="Fee solver" value={solverFee} note={feeLabel(solverFee, bounty, solverPercent)} />
      <Line label="Plataforma recibe total" value={ownerFee + solverFee} />
    </div>
  );
}

function Line({ label, value, note, strong }: { label: string; value: bigint; note?: string; strong?: boolean }) {
  return (
    <div className={`flex flex-wrap justify-between gap-2 py-1 ${strong ? "font-medium text-neon" : "text-muted"}`}>
      <span>{label}</span>
      <span className="text-right">{formatUSDC(value)} USDC {note && <small className="block opacity-70">({note})</small>}</span>
    </div>
  );
}
