# ProblemMarket Infrastructure

## Provisioned Resources

| Platform | Resource | URL / Identifier | Status |
| --- | --- | --- | --- |
| Vercel | `problemarket` project | https://problemarket.vercel.app | Production deployment ready |
| Cloudflare Workers | `problemarket-ipfs-api` | https://problemarket-ipfs-api.mariano-906.workers.dev | Deployed; Pinata secret pending |
| GitHub | Public repository | https://github.com/viveviviendo/problemarket | Created and initial code pushed |

## Vercel Configuration

Project: `viveviendos-projects/problemarket`

Git integration: connected to `https://github.com/viveviviendo/problemarket`.

Configured Production variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `NEXT_PUBLIC_RPC_URL` | `https://sepolia.base.org` |
| `NEXT_PUBLIC_IPFS_API_URL` | `https://problemarket-ipfs-api.mariano-906.workers.dev` |
| `NEXT_PUBLIC_DEV_MODE` | `false` |

Pending Production variables:

| Variable | Reason |
| --- | --- |
| `NEXT_PUBLIC_PROBLEM_MARKET_ADDRESS` | Set after deploying `ProblemMarket` to Base Sepolia. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Requires a WalletConnect Cloud project ID. |
| `NEXT_PUBLIC_SUBGRAPH_URL` | Set after publishing the subgraph. |

`PINATA_JWT` is not stored in Vercel while the production frontend uses the Cloudflare Worker for IPFS uploads.

## Cloudflare Worker Configuration

Worker: `problemarket-ipfs-api`

Configured bindings:

| Binding | Value |
| --- | --- |
| `FRONTEND_ORIGIN` | `https://problemarket.vercel.app` |
| `IPFS_GATEWAY` | `https://ipfs.io/ipfs` |
| `UPLOAD_RATE_LIMITER` | `20` requests per `60` seconds |

Pending secret:

```bash
cd workers/ipfs-api
wrangler secret put PINATA_JWT
```

Until `PINATA_JWT` is set, `POST /upload` intentionally responds with `PINATA_JWT is not configured`.

Manual Worker deployment:

```bash
cd workers/ipfs-api
npm install
npm run build
npx wrangler deploy
```

Wrangler 4 requires Node.js 22 or later.

## GitHub Configuration

Repository: `https://github.com/viveviviendo/problemarket`

GitHub Actions secrets configured:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The repository was created and provisioned through authenticated GitHub CLI because the available GitHub connector does not expose repository creation, Actions secrets or branch-protection writes.
