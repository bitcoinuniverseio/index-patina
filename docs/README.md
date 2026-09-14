# index-patina documentation

Developer and operator documentation for the PATINA indexer and read API. The
repository [README](../README.md) is the short version; these pages are the
detail.

| Page | Read it when |
| --- | --- |
| [architecture.md](architecture.md) | You want to know how a block becomes state, and what each module is responsible for. |
| [configuration.md](configuration.md) | You are setting the service up, or a startup failure named an environment variable. |
| [api.md](api.md) | You are building against the read API. |
| [data-model.md](data-model.md) | You are querying the database directly, or reviewing the schema. |
| [sync.md](sync.md) | You need to know how backfill, reorgs and the mempool overlay actually behave. |
| [operations.md](operations.md) | You are running it: commands, monitoring, backups, upgrades, sizing, troubleshooting. |
| [testing.md](testing.md) | You are changing code, or you want to know what is covered. |
| [releases.md](releases.md) | You are cutting a release, or working out which version you are on. |
| [provenance.md](provenance.md) | You want to verify that no protocol rule is restated here. |
| [ecosystem.md](ecosystem.md) | You want the relationship to the PATINA protocol and to the rest of Bitcoin Universe. |
| [deviations.md](deviations.md) | You are reviewing this service against the PATINA implementation baseline. |

The protocol itself is documented at
<https://bitcoinuniverseio.github.io/patina/>. Nothing in this directory
restates a protocol rule.
