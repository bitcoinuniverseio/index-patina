# API reference

Base path `/patina`, configurable with `PATINA_API_BASE_PATH`. The prefix
follows the organization route standard: an indexer serves under its repository
name with the `index-` prefix removed, so `index-patina` serves `/patina`.

The machine readable document is served at `/openapi.json` and at
`<base>/openapi.json`, and is built from the same router table the service
dispatches on, so the two cannot drift apart.

## Conventions

- Satoshi values serialize as **decimal strings**. Heights serialize as
  **numbers**.
- Paged endpoints accept `cursor` and `limit` and return
  `{ "items": [...], "next_cursor": "..." | null }`.
- A cursor is opaque and encodes the exact sort key of the page boundary, so a
  new block landing between requests cannot make a page skip or repeat a row.
- Errors are `{ "error": "<code>", "message": "...", "details": null }` with an
  HTTP status. A path that exists but does not accept the method returns 405.
- Every response carries `x-content-type-options`, `x-frame-options`,
  `referrer-policy`, `content-security-policy`, `cross-origin-resource-policy`,
  `permissions-policy` and `strict-transport-security`.
- Requests are rate limited per client address in a fixed window
  (`PATINA_API_RATE_LIMIT_MAX` per `PATINA_API_RATE_LIMIT_WINDOW_MS`), returning
  429 `rate_limited` when the budget is spent. `/health` and `/ready` are exempt.
- `POST` bodies over 256 KiB are rejected with 413.

## Endpoints

| Method and path | Returns |
| --- | --- |
| `GET /patina/status` | network, protocol id, specification hash, heights, sync flag, parser and indexer versions, counters |
| `GET /patina/window` | founding window state, bounds, blocks remaining, founding total |
| `GET /patina/artifacts` | page of artifacts, filters `founding`, `status`, `address` |
| `GET /patina/artifacts/:id` | one artifact with depth, tier, next tier and its rings |
| `GET /patina/artifacts/:id/card` | share card payload |
| `GET /patina/addresses/:address/holdings` | artifacts whose carrier pays that address |
| `GET /patina/carriers/:txid/:vout` | one carrier and what rests on it |
| `GET /patina/census/current` | survival table for the epoch holding the indexed tip |
| `GET /patina/census/:epoch` | survival table for one 2016 block epoch |
| `GET /patina/museum` | longest completed rings |
| `GET /patina/leaderboard` | deepest live stretches, `scope=all` or `scope=founding` |
| `GET /patina/shatter` | rings closed, newest first |
| `GET /patina/invalid-events` | rejected attempts with frozen reason codes, filter by `reason` |
| `GET /patina/stats` | counters, tier distribution, invalid event breakdown, reorg count |
| `GET /patina/mempool` | provisional overlay, never part of confirmed state |
| `POST /patina/safety/outpoints` | classify outpoints as `carrier`, `commit` or `none`, nothing stored |
| `GET /health` | liveness, also at `/patina/health` |
| `GET /ready` | readiness, also at `/patina/ready` |
| `GET /metrics` | Prometheus text, also at `/patina/metrics` |
| `GET /openapi.json` | the OpenAPI document, also at `/patina/openapi.json` |

## Sort order and paging keys

| Endpoint | Order | Cursor key |
| --- | --- | --- |
| `/artifacts` | `birth_height DESC, artifact_id DESC` | birth height and artifact id |
| `/museum` | `depth DESC, artifact_id DESC, ring_index DESC` | depth and `artifact_id:ring_index` |
| `/shatter` | `end_height DESC, artifact_id DESC, ring_index DESC` | end height and `artifact_id:ring_index` |
| `/invalid-events` | `id DESC` | row id |
| `/leaderboard` | deepest live stretch first | not paged, `limit` only |

## Reading state

```sh
curl -s http://127.0.0.1:4180/patina/status
```

```json
{
  "network": "regtest",
  "protocol_id": "PTNA",
  "spec_sha256": "...",
  "tip_height": 412,
  "indexed_height": 412,
  "synced": true,
  "parser_version": "patina/1.1.0",
  "indexer_version": "0.2.0",
  "counters": {
    "artifacts_alive": 3,
    "artifacts_relic": 1,
    "founding_total": 2,
    "rings_total": 4,
    "deepest_live_depth": 96,
    "endowment_total_sats": "400000"
  }
}
```

Page through artifacts:

```sh
curl -s "http://127.0.0.1:4180/patina/artifacts?limit=25&status=ALIVE"
curl -s "http://127.0.0.1:4180/patina/artifacts?limit=25&cursor=CURSOR_FROM_PREVIOUS_PAGE"
```

Filter invalid events by a frozen reason code:

```sh
curl -s "http://127.0.0.1:4180/patina/invalid-events?reason=REASON_CODE&limit=50"
```

A `reason` that is not in the protocol package's registered reason codes is
rejected with 400 `invalid_reason`, so a typo never silently returns an empty
page. The registry itself lives in `@bitcoinuniverse/patina`.

## Artifact shape

`GET /patina/artifacts/:id` returns:

```json
{
  "artifact_id": "64 hex characters",
  "birth_txid": "64 hex characters",
  "birth_height": 220,
  "birth_vout": 0,
  "endowment_sats": "100000",
  "founding": true,
  "status": "ALIVE",
  "carrier": {
    "txid": "64 hex characters",
    "vout": 0,
    "height": 316,
    "value": "100000",
    "address": "bcrt1..."
  },
  "claimant_xonly": "64 hex characters",
  "commit": { "txid": "64 hex characters", "vout": 0, "height": 200 },
  "depth": 96,
  "tier": 1,
  "tier_name": "...",
  "next_tier": "...",
  "blocks_to_next_tier": 48,
  "ring_count": 1,
  "relic_height": null,
  "rings": [
    {
      "index": 0,
      "start_height": 220,
      "end_height": 316,
      "depth": 96,
      "carried_value": "100000",
      "successor_txid": "64 hex characters",
      "successor_vout": 0,
      "relic": false
    }
  ]
}
```

`depth`, `tier`, `next_tier` and `blocks_to_next_tier` are computed against the
indexed height at request time, by the protocol package. A `RELIC` artifact has
`carrier: null`.

Validation: an artifact id must be 64 hex characters (400 `invalid_artifact_id`
otherwise), and an unknown id is 404 `artifact_not_found`.

## The safety endpoint

`POST /patina/safety/outpoints` exists so a wallet can check, before it builds a
transaction, whether an outpoint it is about to spend is a live PATINA carrier.

```sh
curl -s -X POST http://127.0.0.1:4180/patina/safety/outpoints \
  -H 'content-type: application/json' \
  -d '{"outpoints":["TXID:0","TXID:1"]}'
```

```json
{
  "network": "regtest",
  "indexed_height": 412,
  "stored": false,
  "outpoints": [
    {
      "outpoint": "TXID:0",
      "protected": true,
      "kind": "carrier",
      "artifact_ids": ["64 hex characters"],
      "detail": "live carrier created at height 316",
      "provisional_spend": null
    }
  ]
}
```

- At most 500 outpoints per request (400 `too_many_outpoints` above that).
- `kind` is `carrier`, `commit` or `none`. `protected` is true for a live
  carrier and for an outpoint an unconfirmed SEED is spending as a commit.
- `provisional_spend` names an unconfirmed transaction already spending the
  outpoint, when the mempool overlay knows of one.
- Nothing from the request body is stored, logged or cached. The response
  carries `Cache-Control: no-store` and `Pragma: no-cache`.

## The mempool view

`GET /patina/mempool` returns the provisional overlay with
`"provisional": true` in its own payload and `Cache-Control: no-store`. It lists
tracked entries, detected replacements and detected conflicts. Nothing in it is
part of confirmed state; a client that ignores this endpoint sees exactly what
the chain confirmed. When `PATINA_MEMPOOL_ENABLED=false` the endpoint answers
with `{"enabled": false, ...}` rather than an error.

## Health, readiness and metrics

| Path | Meaning |
| --- | --- |
| `GET /health` | Liveness. Always 200 while the process serves. |
| `GET /ready` | Readiness. 200 only when the schema is complete, at least one block is indexed and tip lag is 2 blocks or less. 503 otherwise, with `schema_ok`, `missing_tables`, `indexed_height`, `tip_height` and `tip_lag` in the body. |
| `GET /metrics` | Prometheus text exposition, version 0.0.4. |

Use `/ready` as the readiness probe and `/health` as the liveness probe. Both
are exempt from rate limiting so a probe cannot lock itself out.
