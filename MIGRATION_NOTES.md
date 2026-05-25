# Dependency Audit Notes

Audited with:

```bash
npm audit --workspace contracts
npm audit --workspace web
```

Safe non-major lockfile fixes are applied when npm can resolve them without changing application APIs. The high-severity `lodash` advisory was removed through a root override to patched `lodash@4.18.1`. Current audit totals are `2 high / 0 critical` in `contracts` and `4 high / 0 critical` in `web`. Remaining high-severity advisories originate in primary toolchains:

| Workspace | Dependency path | Mitigation status |
| --- | --- | --- |
| `web` | `next` / `eslint-config-next` and transitive `glob` | npm currently proposes upgrading to Next.js 16 and matching ESLint config. This is a framework migration from the required Next.js 14 baseline; do it as a dedicated upgrade with wallet/provider regression testing. |
| `contracts` | `hardhat` through `undici` | npm proposes Hardhat 3, which changes configuration/plugin behavior. Keep deployment to testnet only until a Hardhat 3 migration is tested. |
| `contracts` | `solidity-coverage` through `serialize-javascript` | npm proposes a major downgrade/change of the coverage package. It is development-only and is not shipped to users; evaluate during tooling migration. |

Before mainnet, migrate the toolchains to patched major versions, rerun contract tests/coverage, rebuild the frontend and have escrow logic independently audited.
