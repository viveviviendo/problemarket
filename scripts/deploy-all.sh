#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Running contract tests..."
npm test --workspace contracts

echo "Building frontend and generated ABI..."
npm run build --workspace web

if [[ "${DEPLOY_SUBGRAPH:-false}" == "true" ]]; then
  echo "Deploying subgraph..."
  (cd subgraph && npm run deploy)
else
  echo "Skipping subgraph deploy (set DEPLOY_SUBGRAPH=true after configuring a deployment script)."
fi

echo "Deploying Cloudflare IPFS Worker..."
(cd workers/ipfs-api && npx wrangler deploy)

echo "Deploying frontend to Vercel production..."
npx vercel --prod
