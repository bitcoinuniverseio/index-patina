# Operations

## Requirements

- Node.js 24.19.0 and npm 11.17.0 (pinned in `package.json` `engines`,
  `.nvmrc` and `.node-version`)
- Bitcoin Core with `-txindex=1` and RPC enabled
- Roughly 200 MB of disk for a signet database, more for mainnet

## Install and build

The exact protocol package is committed under `vendor/` and pinned by SHA-256 in
`SOURCE-PROVENANCE.json`. A sibling PATINA checkout is not required.

```sh
npm ci
npm run verify:vendor
npm run build
```

## Commands

| Command | What it does |
| --- | --- |
| `sync` | Backfill history, then follow the tip. `--once` runs a single pass and exits. |
| `serve` | Serve the read API. Also syncs unless `--api-only` is given. |
| `reindex` | Drop every derived row and rebuild from the start height. |
| `reindex-range --from N [--to M]` | Roll back to `N-1` and rebuild forward. |
| `verify` | Replay every stored block and compare the recomputed state root with the stored one. Exit 1 on any mismatch. `--json` for machine output. |
| `status` | Print heights, counters and schema integrity. `--json` for machine output. Exit 1 when a table is missing or a foreign key is dangling. |

Exit codes: `0` success, `1` a command level failure (mismatch, integrity
problem, unknown command), `2` a configuration problem, reported as a list.

```sh
node bin/index-patina.mjs serve                      # sync and serve
node bin/index-patina.mjs sync                       # ingest only
PATINA_RPC_OFFLINE=true \
  node bin/index-patina.mjs serve --api-only         # serve without a node
```

Both long running commands handle `SIGINT` and `SIGTERM`: they finish the block
in flight, close the HTTP listener, close the database and exit 0.

## Docker

The image builds from this repository alone because the pinned protocol package
is vendored, so the build context needs no sibling checkout.

```sh
docker compose up -d indexer              # indexer only, point it at your node
docker compose --profile core up -d       # indexer plus a regtest Bitcoin Core
```

The image runs as an unprivileged user, read only, with `no-new-privileges` and
all capabilities dropped, and carries a `HEALTHCHECK` that polls `/health`.
`docker-compose.yml` already sets those options.

## Monitoring

`GET /metrics` returns Prometheus text. The series worth alerting on:

| Series | Alert when |
| --- | --- |
| `patina_tip_lag_blocks` | above 3 for more than a few minutes |
| `patina_synced` | 0 for more than a few minutes |
| `patina_rpc_failures_total` | rising |
| `patina_reorgs_total` | rising faster than the network reorg rate |
| `patina_api_errors_total` | any increase |
| `patina_api_request_duration_seconds` | p99 above your budget |

Also published: `patina_indexed_height`, `patina_tip_height`,
`patina_artifacts_alive`, `patina_artifacts_relic`, `patina_founding_total`,
`patina_rings_total`, `patina_deepest_live_depth`,
`patina_endowment_total_sats`, `patina_invalid_events_total`,
`patina_mempool_entries`, `patina_blocks_applied_total`,
`patina_blocks_rolled_back_total`, `patina_rpc_calls_total`,
`patina_api_requests_total`, `patina_uptime_seconds`.

Every series carries a `network` label. Counters owned by the process
(`patina_blocks_applied_total`, `patina_rpc_calls_total`,
`patina_api_requests_total` and the rest) reset on restart, as Prometheus
counters are expected to.

Probes: `GET /ready` for readiness, `GET /health` for liveness. `/ready` returns
503 until the schema is complete, at least one block is indexed and tip lag is 2
blocks or less.

Logs are one JSON object per line on stdout. Ship them as they are.

## Backup and recovery

The database is a single SQLite file (plus its WAL). Everything in it is derived
from the chain, so a lost database costs a resync, not data. What a backup buys
you is the time that resync would take.

Back up with the database quiesced, or use SQLite's own online backup. Stopping
the process is the simple path:

```sh
# stop the service, then
cp /var/lib/patina/patina-signet.sqlite /backup/patina-signet.sqlite
```

Restoring is a file copy back and a restart. On startup the service rebuilds the
snapshot from the tables and compares its state root with the root recorded for
the tip block, so a truncated or mixed restore is caught immediately instead of
being served.

## Upgrade and migration

Schema migrations are additive and tracked in `schema_migrations`; `migrate()`
applies only what has not been applied, and applying twice is a no-op.

A **protocol package upgrade is different.** Every block row records the parser
version that wrote it, and the database is bound to one specification hash. When
either changes, startup fails with both values named. That is deliberate: a
mixed history is worse than a rebuild.

```sh
node bin/index-patina.mjs reindex
```

The same applies to a change of deployment record that alters the specification
hash. Plan a reindex window rather than discovering it at restart.

Upgrade order that avoids surprises:

1. Read the release notes for the protocol package version the new build pins.
2. Take a backup of the current database.
3. Deploy the new build with the indexer stopped.
4. Run `index-patina status` and see whether it reports a parser or
   specification mismatch.
5. If it does, run `reindex`. If it does not, start normally.

## Performance sizing

- **One process, one database.** The sync loop is serial by design. Scale reads
  by running additional `serve --api-only` processes against a copy of the
  database, not by pointing two writers at one file.
- **Memory.** The dominant consumer is the resolver's prevout cache, bounded at
  200 000 entries, plus 20 000 block heights and a transaction to block-hash map
  that is cleared past 500 000 entries. The rest is SQLite's own page cache.
- **Disk.** WAL mode with `synchronous = NORMAL`. Put the database on local
  storage, not a network filesystem; SQLite locking over NFS is a known way to
  corrupt a database.
- **The node is usually the bottleneck.** Backfill speed is dominated by
  `getblock` and `getrawtransaction` latency. A local node beats a remote one by
  more than any tuning in this process.
- **API.** The in-process rate limiter is a floor, not a substitute for a limit
  at your proxy. It is per process and resets when the process restarts.

## Troubleshooting

Organized by what you actually see.

### The process exits immediately with a list of problems and code 2

Configuration. Every problem is reported together. Fix them all and restart. See
[configuration.md](configuration.md).

### "mainnet refused: ..."

The mainnet gate. Both `PATINA_MAINNET_AUTHORIZED=true` and a deployment record
naming at least two distinct approvers are required. The protocol package
enforces the record independently.

### "state rebuilt from the database has root X but block N recorded Y"

The state rebuilt from the tables disagrees with the root the reducer recorded
for the tip block. Do not serve from it. Run `verify` to find the first height
that diverges, then `reindex-range --from <that height>`. If the divergence
starts at the first indexed block, run `reindex`.

### "database was written by parser ... this build is ..."

Expected after a protocol package upgrade. Run `reindex`.

### "database was written against specification ... this deployment pins ..."

The deployment record changed the specification hash. Run `reindex`.

### "database holds <network> data, refusing to open it as <network>"

The database path points at another network's file. Check `PATINA_DATA_DIR` and
`PATINA_DB_PATH`.

### "reorg of N blocks exceeds PATINA_MAX_REORG_DEPTH"

The process stops rather than rolling back blindly. Confirm with your node how
deep the reorg actually went, then `reindex-range --from <fork height + 1>`.

### A reorg reached past the retained undo window

Undo documents below `PATINA_UNDO_RETENTION_BLOCKS` are pruned.
`reindex-range --from <fork height + 1>` rebuilds from chain data rather than
from undo documents.

### "prevout ... has no confirmed creation height, refusing to guess"

Bitcoin Core is running without `-txindex=1`, or the parent transaction has been
pruned. Enable the transaction index and restart.

### "bitcoin rpc rejected the credentials with HTTP 401"

RPC user, password or cookie file. A cookie file is re-read on every call, so a
node restart that rewrites the cookie does not need an indexer restart.

### "bitcoin rpc <method> unreachable after N attempts"

Transport, not protocol. The client retried `PATINA_BITCOIN_RPC_MAX_RETRIES + 1`
times with backoff. Check the node is up and the URL is right.

### Tip lag keeps growing

Check `patina_rpc_failures_total` and the Core logs first. The indexer applies
blocks one at a time and catches up on its own once Core answers.

### `/ready` returns 503 but the service is running

Read the body. It names which of the three conditions failed: schema complete,
at least one block indexed, tip lag 2 or less. During a backfill the third one
is expected to fail until the backfill finishes.

### Counters look wrong but the roots match

The roots are the source of truth. Counters are derived from the same rows and
are checked against the tip root at startup. If `verify` is clean, the state is
correct.

### `npm ci` fails building `better-sqlite3` from source

`better-sqlite3` ships prebuilt binaries for Linux, macOS and Windows. On a
machine without a working node-gyp toolchain the install script can still try to
compile and fail. `npm ci --ignore-scripts` installs the shipped prebuild, which
is enough to typecheck, build and run the test suite. The Docker build installs
a compiler in its build stage and does not need this.
