# ProblemMarket

![CI](https://github.com/viveviviendo/problemarket/actions/workflows/ci.yml/badge.svg)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

ProblemMarket is a USDC escrow marketplace for pseudonymous wallets. An owner funds a problem, solvers submit IPFS-backed proposals, and the owner releases payment to one accepted solver. This repository contains:

- `contracts/`: Solidity escrow, mock USDC, Hardhat tests and Base Sepolia deployment script.
- `web/`: Next.js 14 App Router client with RainbowKit/wagmi, marketplace filters, publishing flow, problem review and wallet dashboard.
- `subgraph/`: The Graph event-indexing scaffold for protocol and user statistics.
- `workers/ipfs-api/`: Cloudflare Worker edge endpoint for production Pinata/IPFS uploads.

## Fee model

The initial configuration is 2.5% for each side with a minimum fee of `0.10 USDC`.

For a `50 USDC` problem:

| Moment | Movement |
| --- | ---: |
| Publish: bounty escrow | 50.00 USDC |
| Publish: owner fee deposited | 1.25 USDC |
| Accept: solver receives | 48.75 USDC |
| Accept: platform receives owner + solver fees | 2.50 USDC |

Charging the owner fee at creation is deliberate: the contract can never promise `50 USDC` of bounty and later attempt to pay `52.50 USDC` from an underfunded escrow. Fees for each individual problem are snapshotted when it is created.

## Security and privacy decisions

- Funds move through `SafeERC20` and transfer paths use `ReentrancyGuard`.
- Only submitted solvers can be paid; owners cannot submit to their own problem.
- An owner may cancel before proposals arrive, or after a deadline has expired. This prevents withdrawing an active bounty while a timely solution is under review.
- A participant may dispute; in this MVP the contract owner resolves disputes. A decentralized arbitration adapter is a later upgrade.
- Pausing blocks new activity and acceptance while still allowing refunds and dispute resolution.
- At most ten active problems per wallet are permitted initially.

Wallet addresses, events and any URI submitted to a public blockchain are public. The app gathers no email, real name, analytics identifier or tracking cookie, but it provides pseudonymity rather than "total anonymity." Sensitive solutions require client-side encryption before their URI is submitted on-chain.

## Local setup

Prerequisites: Node.js 20+ and npm for the app and contracts. Deploying the Cloudflare Worker with Wrangler 4 requires Node.js 22+.

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Open `http://localhost:3000`. Without contract addresses, the UI renders but does not send transactions. Without `PINATA_JWT`, publication is blocked by default. Setting `NEXT_PUBLIC_DEV_MODE=true` explicitly allows a development-only fallback that stores plaintext/JSON directly on-chain.

## Contracts

Run tests and coverage:

```bash
npm run test --workspace contracts
npm run coverage --workspace contracts
```

Deploy to Base Sepolia after setting `DEPLOYER_PRIVATE_KEY`, `USDC_ADDRESS`, `FEE_COLLECTOR_ADDRESS`, `BASESCAN_API_KEY` and optionally a custom RPC endpoint. Full steps are in `DEPLOY.md`:

```bash
npm run deploy:base-sepolia --workspace contracts
```

Put the resulting address and the network USDC address into `web/.env.local`:

```bash
NEXT_PUBLIC_PROBLEM_MARKET_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
PINATA_JWT=...
NEXT_PUBLIC_DEV_MODE=false
```

The deployment script defaults to:

- Owner fee: `250` basis points.
- Solver fee: `250` basis points.
- Minimum fee: `100000` USDC base units.
- Bounty range: `1_000_000` through `100_000_000` USDC base units.
- Active-problem cap: `10`.

## Subgraph

Replace the zero address and `startBlock` in `subgraph/subgraph.yaml` with the deployed market contract, then run:

```bash
cd subgraph
npm install
npm run codegen
npm run build
```

The frontend currently reads directly through `wagmi`, so it works before a hosted subgraph is published. The indexed `ProtocolStats`, `Problem`, `Solution` and `UserStats` entities are ready to replace those reads at scale.

## Production checklist

- Audit the escrow and fee-collector dispute power before mainnet.
- Use a multisig for contract ownership and fee collection.
- Deploy/verify against official USDC addresses on each supported network.
- Encrypt private solution payloads before pinning to IPFS.
- Configure a reliable IPFS pinning provider and publish the subgraph.
