# Testing

## Running the suite

```sh
npm ci
npm run verify          # vendor check, typecheck, build, test
```

Or the steps on their own:

```sh
npm run verify:vendor   # recompute the vendored tarball hashes
npm run typecheck       # tsc --noEmit
npm run build           # tsc -p tsconfig.build.json, emits dist/
npm test                # builds test sources, then node --test on dist/test
```

`npm test` runs `build:test` first, so the suite always executes the compiled
output rather than a source transform.

**No Bitcoin node is required.** The suite drives a synthetic regtest chain
through the offline RPC client, so the real resolver, the real reducer and the
real store are exercised end to end. Nothing between the RPC boundary and the
database is replaced with a stub.

Last measured on this repository at commit `fa1e2e0`: **81 tests, 12 suites, 0
failures**, about 10 seconds.

## What the fixtures build

`test/fixtures/chain.ts` builds a complete synthetic PATINA history: commit
outputs, SEED reveals in the founding window, a SEED whose carrier is below the
founding minimum, KEEP transactions, bundled artifacts sharing one carrier, an
artifact with no eligible successor, invalid attempts, and a chain deep enough
for tier and census arithmetic.
`test/fixtures/harness.ts` wires a store, an offline RPC client, an indexer and
an API over that chain.

## Coverage by file

| File | Covers |
| --- | --- |
| `test/lifecycle.test.ts` | The full lifecycle: every block stored with a state root, SEED creating a founding artifact with the carrier it named, a SEED below the founding minimum creating nothing, the default successor rule bundling two artifacts onto one output, KEEP routing a bundle to the output it names, the default rule stepping over an OP_RETURN output, an artifact with no eligible successor becoming a relic, the in-memory snapshot agreeing with the database, counters matching the artifacts that exist, invalid events carrying frozen reason codes, commit reveals recorded against the artifacts they created, marker bytes recorded on protocol relevant transactions, and an undo document existing for every applied block. |
| `test/replay.test.ts` | Determinism: re-applying a stored block is a no-op, a second sync pass applies nothing, a restart rebuilds the snapshot from the database and continues, `reindex` reproduces identical roots at every height, `reindex-range` rebuilds a window onto the same roots, `verify` finds no mismatch, and checkpoints land on the configured interval. |
| `test/reorg.test.ts` | Rollback restores the exact state root recorded before the block, state undone by a reorg equals the state before it, and rolling back past the first SEED removes the artifact entirely. |
| `test/mempool.test.ts` | An unconfirmed carrier spend is tracked without touching confirmed state, a replacement sharing an input is recorded as a replacement, two unconfirmed transactions claiming one outpoint are recorded as a conflict, a transaction with no protocol role is not tracked, and confirming a transaction drops it from the overlay. |
| `test/api.test.ts` | Every endpoint's contract, paging and cursor walking across the whole set, filters, 404 and 405 behaviour, input validation for `limit`, `cursor`, `reason`, artifact id, txid and vout, the rate limiter refusing a client over budget, security headers on every response, `/health`, `/ready` and `/metrics` answering at both the root and the base path, and `/openapi.json` documenting every registered route. |
| `test/config.test.ts` | The shipped regtest deployment record loading with the protocol constants, an unknown network refused outright, every problem reported together rather than one at a time, an online client without credentials refused, mainnet refused without the authorization, refused with fewer than two approvers, refused with no deployment file, accepted when both conditions hold, and deployment documents accepted in the baseline snake_case form. |
| `test/census.test.ts` | Epoch arithmetic on the 2016 block boundary, the census being identical on repeated calls, history reconstruction answering where an artifact was at any height, and an epoch the chain has not reached reporting zeroes rather than stale counts. |
| `test/store.test.ts` | Migrations creating every expected table, migrating twice applying nothing, foreign keys and check constraints being enforced, the database binding to one network, parser and specification, an empty store reporting height -1, and address rendering for segwit v0 (bech32), taproot (bech32m), P2PKH and P2SH (base58) and a bare OP_RETURN (no address). |
| `test/bip110.test.ts` | Commit leaf compatibility: new construction uses the reduced-data leaf while both encodings stay parseable, and legacy and reduced-data histories index and replay to identical artifact ids and per-block state roots. |
| `test/server.test.ts` | The `node:http` adapter serving the same handlers over a real socket, `status` and `verify` running against a fresh database, mainnet without an authorization exiting with the configuration code, and an unknown command being refused. |

## What the suite does not cover

- A live Bitcoin Core. The RPC client's HTTP path, its retry behaviour and
  cookie authentication are exercised against a real node only in a manual test.
- Mainnet. The deployment is fail closed and not activated, so there is no
  mainnet history to index and nothing to assert against.
- Load and long-running behaviour. There is no benchmark or soak test in this
  repository.

## Continuous integration

`.github/workflows/ci.yml` runs on the self-hosted fleet, never on a
GitHub-hosted runner. Two jobs:

1. **build-and-test**: checkout, `universe-node-env`, `npm audit --omit=dev
   --audit-level=high`, `verify:vendor`, `typecheck`, `build`, `test`, then an
   offline command line smoke test running `status --json` and `verify`.
2. **docker**: builds the image with `portable-container-build` and runs
   `status --json` inside it before cleanup.

Both jobs skip for pull requests from forks, because the shared runner fleet
does not execute untrusted code.
