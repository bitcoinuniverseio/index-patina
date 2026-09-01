# Configuration

Every setting comes from the environment. `.env.example` is the shipped
reference and every value in it is the built-in default unless its comment says
otherwise.

The process collects every configuration problem and reports them together,
then exits with code **2** rather than starting in a half valid state. There is
no partial start.

## Network

| Variable | Default | Meaning |
| --- | --- | --- |
| `PATINA_NETWORK` | `regtest` | One of `regtest`, `signet`, `mainnet`. Anything else is refused immediately. |
| `PATINA_MAINNET_AUTHORIZED` | `false` | Operator half of the mainnet gate. See [Mainnet](#mainnet). |
| `PATINA_DEPLOYMENT_FILE` | unset | Path to a reviewed deployment record. Required for mainnet. |
| `PATINA_H_OPEN` | unset | Build a deployment from a chosen window opening height. Test networks only. |
| `PATINA_SPEC_SHA256` | unset | Specification hash bound to `PATINA_H_OPEN`. Both are required together. |

When `PATINA_DEPLOYMENT_FILE` is unset on `regtest` or `signet`, the deployment
record shipped inside `@bitcoinuniverse/patina` is used
(`deployments/<network>.json`).

## Bitcoin Core

| Variable | Default | Meaning |
| --- | --- | --- |
| `PATINA_BITCOIN_RPC_URL` | `http://127.0.0.1:18443` regtest, `:38332` signet, `:8332` mainnet | Must be `http` or `https`. |
| `PATINA_BITCOIN_RPC_USER` | empty | RPC user. |
| `PATINA_BITCOIN_RPC_PASSWORD` | empty | RPC password. |
| `PATINA_BITCOIN_RPC_COOKIE_FILE` | unset | Cookie file instead of user and password. Must exist at startup. |
| `PATINA_BITCOIN_RPC_TIMEOUT_MS` | `30000` | 1000 to 600000. |
| `PATINA_BITCOIN_RPC_MAX_RETRIES` | `3` | 0 to 20. Retries transport failures only, with backoff capped at 2 seconds. |
| `PATINA_RPC_OFFLINE` | `false` | Serve an already indexed database with no node attached. Sync does nothing in this mode. |

Unless `PATINA_RPC_OFFLINE=true`, startup requires either
`PATINA_BITCOIN_RPC_USER` or `PATINA_BITCOIN_RPC_COOKIE_FILE`. Neither one set
is a configuration error, not a runtime surprise.

**Bitcoin Core must run with `-txindex=1`.** The resolver needs the creation
height of every input a transaction spends, and that lookup goes through
`getrawtransaction`. Without the transaction index, sync stops with
`prevout ... has no confirmed creation height, refusing to guess`.

## Storage

| Variable | Default | Meaning |
| --- | --- | --- |
| `PATINA_DATA_DIR` | `./data` | Created if missing. Relative paths resolve against the working directory. |
| `PATINA_DB_PATH` | `<data dir>/patina-<network>.sqlite` | Set `:memory:` for a throwaway database. |

The database opens with `journal_mode = WAL`, `synchronous = NORMAL`,
`foreign_keys = ON` and `busy_timeout = 5000`.

## Indexer

| Variable | Default | Bounds | Meaning |
| --- | --- | --- | --- |
| `PATINA_START_HEIGHT` | window opening height minus `commit_min_age`, floored at 0 | min 0 | First height to index. The default is the earliest block that can matter. |
| `PATINA_POLL_INTERVAL_MS` | `3000` | 100 to 600000 | Wait between passes once caught up. |
| `PATINA_CHECKPOINT_INTERVAL` | `2016` | 1 to 1000000 | A checkpoint row is written at every height divisible by this value. |
| `PATINA_UNDO_RETENTION_BLOCKS` | `2016` | 1 to 1000000 | Undo documents below `tip - retention` are pruned. |
| `PATINA_MAX_REORG_DEPTH` | `200` | 1 to 100000 | A deeper reorg stops the process instead of rolling back blindly. |
| `PATINA_MEMPOOL_ENABLED` | `true` | | Provisional unconfirmed overlay. |
| `PATINA_MEMPOOL_POLL_INTERVAL_MS` | `5000` | 500 to 600000 | Overlay refresh interval. Refresh only runs while caught up. |

## API

| Variable | Default | Bounds | Meaning |
| --- | --- | --- | --- |
| `PATINA_API_HOST` | `127.0.0.1` | | Bind address. |
| `PATINA_API_PORT` | `4180` | 0 to 65535 | Port `0` binds an ephemeral port. |
| `PATINA_API_BASE_PATH` | `/patina` | | Must start with `/` and must not end with `/`. |
| `PATINA_API_DEFAULT_LIMIT` | `50` | 1 to 1000 | Page size when the caller sends no `limit`. |
| `PATINA_API_MAX_LIMIT` | `200` | 1 to 1000 | Must be at least the default limit. |
| `PATINA_API_RATE_LIMIT_MAX` | `120` | 1 to 1000000 | Requests per window, per client address. |
| `PATINA_API_RATE_LIMIT_WINDOW_MS` | `60000` | 1000 to 3600000 | Fixed window length. |
| `PATINA_API_CORS_ORIGIN` | unset | | Set only if a browser origin must read this API directly. |
| `PATINA_API_PUBLIC_URL` | unset | | Written into the `servers` block of `/openapi.json`. |

The base path default of `/patina` is the organization route standard: an
indexer serves under its repository name with the `index-` prefix removed.

## Logging

| Variable | Default | Meaning |
| --- | --- | --- |
| `PATINA_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`, `silent`. |

Logs are one JSON object per line on stdout.

## Mainnet

Mainnet is fail closed. Two conditions must both hold or the process refuses to
start:

1. `PATINA_MAINNET_AUTHORIZED=true`
2. `PATINA_DEPLOYMENT_FILE` points at a deployment record that names at least
   two distinct approvers and pins the specification hash

The protocol package applies the same rule to the record independently, so
removing the check in this repository alone does not open the gate. Missing
either condition exits with code 2 and a message naming what is missing.

A deployment record looks like this. Baseline snake_case field names are
accepted as well as camelCase, and `config.ts` normalizes before handing the
document to the protocol package for validation.

```json
{
  "network": "mainnet",
  "protocol_id": "PTNA",
  "spec_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "h_open": 900000,
  "h_close": 904032,
  "grace_end": 908064,
  "min_carrier_founding": 100000,
  "min_carrier_open": 10000,
  "commit_min_age": 144,
  "approvers": ["First Approver", "Second Approver"]
}
```

`spec_sha256` above is a placeholder. Use the 64 hex character specification
hash of the deployment you are actually running; the database is bound to it and
a later change forces a reindex.

## A worked regtest configuration

```sh
PATINA_NETWORK=regtest
PATINA_BITCOIN_RPC_URL=http://127.0.0.1:18443
PATINA_BITCOIN_RPC_COOKIE_FILE=/home/bitcoin/.bitcoin/regtest/.cookie
PATINA_DATA_DIR=/var/lib/patina
PATINA_API_HOST=127.0.0.1
PATINA_API_PORT=4180
PATINA_LOG_LEVEL=info
```

## Reading the configuration back

`index-patina status` prints the network, the resolved deployment source, the
specification hash, the parser version and the database path, so an operator can
confirm what the process actually loaded rather than what the file was meant to
say.

```sh
node bin/index-patina.mjs status --json
```
