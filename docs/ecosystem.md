# PATINA and the rest of Bitcoin Universe

## What PATINA is

PATINA is an original Bitcoin Universe protocol. It is a provenance layer: it
accumulates verifiable history over an artifact that already exists, rather than
creating a new asset. It does not mint. It accrues.

The unit of that history is time an output stays unspent. A SEED binds an
artifact to a carrier output; while that carrier is unspent the artifact's depth
grows block by block; a KEEP moves the artifact to a successor output and closes
a ring; an artifact with no eligible successor becomes a relic.

The rules, the byte layouts, the reason code registry, the JSON Schemas and the
conformance vectors are all in the protocol repository:

- Site: <https://bitcoinuniverseio.github.io/patina/>
- Repository: <https://github.com/bitcoinuniverseio/patina>

This repository does not restate any of them. See [provenance.md](provenance.md).

## What this indexer adds

The protocol package can decide, given a resolved block, what happened. It has
no opinion about where blocks come from, how they are stored, or how anyone
queries the result. This repository is that part: an ingest path from Bitcoin
Core, a durable and reorg-safe store, and a read API.

## No Universe product implements a PATINA trade path

The published capability snapshot at
`packages/ecosystem-registry/data/capability-snapshot.json` in the documentation
platform records, per protocol, which Universe surfaces implement which actions,
along with the marketplace ownership, availability and mode where one exists.

**PATINA has no entry in that snapshot at all.** It is not among the protocols
the snapshot covers, and it therefore has no marketplace entry: no Universe
product implements list, buy, offer, or settle for a PATINA artifact, and there
is no trade path to describe.

State that plainly to anyone who asks. Do not infer a marketplace from the
existence of this indexer, and do not describe one as planned. If that changes,
it will change in the snapshot first, because the snapshot is generated from the
product code rather than written by hand.

The read API here is exactly what its name says: read only. It holds no keys,
signs nothing, broadcasts nothing, and quotes no prices. The one endpoint that
touches a caller's own data, `POST /patina/safety/outpoints`, exists to stop a
wallet from accidentally spending a live carrier, and stores nothing.

## Related repositories

The two public repositories a developer needs:

| Repository | Holds |
| --- | --- |
| [`bitcoinuniverseio/patina`](https://github.com/bitcoinuniverseio/patina) | The protocol: specification, reference implementation, JSON Schemas, conformance vectors. |
| [`bitcoinuniverseio/index-patina`](https://github.com/bitcoinuniverseio/index-patina) | This repository: the indexer and read API. |

Reader-facing documentation is published on the portal at
<https://docs.bitcoinuniverse.io/>.

Cross-link between repositories rather than copying. In particular, do not copy
protocol rules into this repository, where they would drift.
