# Base Sepolia Deployment

## 1. Configure environment

Copy `.env.example` to `.env`, provide a funded deployer key without `0x`, the treasury/dispute resolver wallet, a Basescan API key and the official Base Sepolia USDC address. Do not use `DEPLOY_MOCK_USDC=true` on a public deployment.

```bash
cp .env.example .env
npm install
npm run compile
```

## 2. Obtain test funds

- Obtain Base Sepolia ETH for gas from the [Base faucet guide](https://docs.base.org/base-chain/tools/network-faucets).
- Obtain test USDC using the [Circle faucet](https://faucet.circle.com/) and select Base Sepolia.

## 3. Deploy and verify

The deployment script creates `ProblemMarket`, uses the supplied USDC token and verifies automatically when `BASESCAN_API_KEY` is present:

```bash
npx hardhat run contracts/scripts/deploy-testnet.ts --config contracts/hardhat.config.ts --network baseSepolia
```

Alternatively:

```bash
npm run deploy:base-sepolia --workspace contracts
```

It prints JSON containing the contract addresses and timestamp. Retain that output with your deployment record.

## 4. Configure the frontend

Create `web/.env.local` and copy the resulting market address and the same USDC address:

```env
NEXT_PUBLIC_PROBLEM_MARKET_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_SUBGRAPH_URL=
PINATA_JWT=...
NEXT_PUBLIC_DEV_MODE=false
```

Pinata is required for a public deployment. Without it, publication is blocked unless development mode is explicitly enabled; development mode stores content as plaintext/JSON on-chain.

## 5. Build and host

```bash
npm run build --workspace web
```

Deploy `web/` to Vercel or Netlify with the frontend environment variables configured in the hosting dashboard. Replace the zero address in `subgraph/subgraph.yaml` and deploy the subgraph before setting `NEXT_PUBLIC_SUBGRAPH_URL`.

## CI/CD With GitHub Actions

The repository includes:

- `.github/workflows/ci.yml`: contract tests/coverage, frontend build, subgraph build, Worker type-check and Worker dry-run bundle validation on pushes and pull requests targeting `main`.
- `.github/workflows/deploy-vercel.yml`: production Vercel deployment only after the `CI` workflow succeeds on `main`.

Because this is an npm-workspaces monorepo with one root lockfile, CI installs dependencies with `npm ci` at the repository root for contracts and web. Do not switch these jobs to independent `npm ci` commands unless separate lockfiles are introduced.

Configure repository secrets in GitHub Settings -> Secrets and variables -> Actions:

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Vercel token from [account tokens](https://vercel.com/account/tokens). |
| `VERCEL_ORG_ID` | Team or account identifier created by `vercel link` / project settings. |
| `VERCEL_PROJECT_ID` | Project identifier in `.vercel/project.json` after linking locally. |
| `BASESCAN_API_KEY` | Optional verification credential for contract deployment workflows. |
| `PRIVATE_KEY` | Optional testnet-only contract deploy key; do not automate mainnet deployment from Actions. |

For pull-request previews, prefer Vercel's GitHub integration: it publishes preview URLs without exposing production deployment secrets to untrusted PR workflows.

## Vercel Frontend

Import the GitHub repository in Vercel. Keep **Root Directory** at the repository root rather than `web/`: the frontend imports the Hardhat-generated ABI from `contracts/artifacts`, and `web/prebuild` compiles it before Next builds. The committed `vercel.json` configures:

- Build command: `npm run build --workspace web`
- Output directory: `web/.next`
- Security headers, including CSP, frame blocking and referrer policy

Set these Production environment variables in Vercel:

```env
NEXT_PUBLIC_PROBLEM_MARKET_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_SUBGRAPH_URL=
NEXT_PUBLIC_IPFS_API_URL=https://problemarket-ipfs.<your-subdomain>.workers.dev
NEXT_PUBLIC_DEV_MODE=false
```

`PINATA_JWT` is only required in Vercel when deliberately using the local Next API fallback. With the Cloudflare Worker configured, store `PINATA_JWT` only as a Worker secret.

Vercel serves HTTPS by default. Add your production and `www` domains in Project Settings -> Domains.

## Cloudflare IPFS Worker

The Worker lives at `workers/ipfs-api/` and exposes:

- `POST /upload`: validates and pins problem/solution JSON to IPFS through Pinata.
- `GET /:hash`: reads JSON through the configured public gateway.

It accepts only the configured `FRONTEND_ORIGIN` through CORS and applies a Cloudflare native upload rate-limit binding. The binding keys requests by connecting IP because this wallet-only MVP has no authenticated application user; Cloudflare notes that shared IPs may group legitimate visitors, so tune the limit after observing traffic.

Configure `workers/ipfs-api/wrangler.toml` before production:

1. Replace `FRONTEND_ORIGIN` with your Vercel or custom frontend origin.
2. Choose a rate-limiter `namespace_id` unique within your Cloudflare account.
3. Use Node.js 22 or later for Wrangler 4 commands; the Worker CI job already does this.
4. Authenticate and provide the Pinata secret:

```bash
cd workers/ipfs-api
npm install
npx wrangler login
npx wrangler secret put PINATA_JWT
npm run build
npm run deploy
```

For local Worker testing, copy `.dev.vars.example` to `.dev.vars`; this file is ignored and must never be committed.

Optional R2 backups: create an R2 bucket named `problemarket-backups`, add an `r2_buckets` binding in Wrangler, and extend the Worker to store pinned JSON after a successful Pinata upload. R2 is intentionally not enabled by default because IPFS remains the current source of stored submissions.

## Cloudflare DNS For A Vercel Domain

1. Add both the apex domain and `www` domain in Vercel Project Settings -> Domains.
2. In Cloudflare DNS, create `CNAME www -> cname.vercel-dns.com`.
3. For the apex domain, use Cloudflare CNAME flattening to the Vercel DNS target, or configure the records that Vercel shows for that domain.
4. Set Cloudflare SSL/TLS mode to **Full (strict)**.
5. If certificate validation or redirect loops occur, set the Vercel-facing records to DNS-only while diagnosing; otherwise proxied mode can remain enabled with Full strict.
6. Enable Always Use HTTPS in Cloudflare settings if Cloudflare is proxying traffic.

## Unified Deployment Script

After authenticating `wrangler` and `vercel`, with Node.js 22 active for Wrangler, and after CI is green:

```bash
./scripts/deploy-all.sh
```

It tests contracts, builds the frontend, deploys the Worker and deploys Vercel production. Subgraph deployment remains opt-in until a hosted Graph deployment target and deploy command are configured.

## Troubleshooting

- CORS failure: set `FRONTEND_ORIGIN` in `wrangler.toml` exactly to the browser origin, without a trailing slash, then redeploy the Worker.
- Vercel cannot find the ABI: ensure Vercel Root Directory is the repository root and the committed build command runs the `web` workspace build.
- Wallet connections blocked by CSP: inspect browser CSP reports before expanding `connect-src` or `frame-src`; do not remove security headers wholesale.
- SSL errors with a custom domain: confirm Vercel has issued the domain certificate and use Cloudflare Full (strict), temporarily disabling proxying only for diagnosis.
