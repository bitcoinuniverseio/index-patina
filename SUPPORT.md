# Support

## Start here

| Question | Where to look |
| --- | --- |
| It will not start, and it printed a list of problems | [docs/configuration.md](docs/configuration.md) |
| It started and then stopped, or an error message names a state root, a parser or a reorg | [docs/operations.md](docs/operations.md#troubleshooting) |
| What does this endpoint return | [docs/api.md](docs/api.md), or `GET /openapi.json` from a running instance |
| What does this table hold | [docs/data-model.md](docs/data-model.md) |
| How fast will it sync, how much disk | [docs/sync.md](docs/sync.md) |
| What version am I running | `GET /patina/status`, or `index-patina status` |
| Is this a protocol question or an indexer question | [docs/ecosystem.md](docs/ecosystem.md) |

Most reports turn out to be one of three things: Bitcoin Core running without
`-txindex=1`, a database written by a different protocol package version, or the
mainnet gate refusing to open. All three are described in
[docs/operations.md](docs/operations.md#troubleshooting) and all three name
themselves in the error message.

## Protocol questions belong upstream

Whether a SEED is valid, how a successor is chosen, what a reason code means and
what the byte layout of a marker is are all protocol questions. They are answered
in the protocol repository, not here:

- <https://bitcoinuniverseio.github.io/patina/>
- <https://github.com/bitcoinuniverseio/patina>

## Reporting a problem

Open an issue on <https://github.com/bitcoinuniverseio/index-patina/issues>.

Include:

- the network and the output of `index-patina status --json`, which names the
  network, the deployment source, the specification hash, the parser version and
  the indexed and tip heights,
- the commit or image tag you are running,
- the exact error text, and the surrounding log lines (logs are one JSON object
  per line),
- what you expected instead.

If the problem is a state disagreement, run `index-patina verify` and include the
first mismatching height. That single number usually identifies the cause.

Do not paste RPC credentials, cookie file contents, or a deployment record you
have not reviewed for private content.

## Security reports

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## What is out of scope

- Running Bitcoin Core. Point this service at a node you already operate.
- Wallet operations. This service holds no keys and cannot sign or broadcast.
- Trading. No Universe product implements a PATINA trade path; see
  [docs/ecosystem.md](docs/ecosystem.md).
- Mainnet activation. The gate is fail closed by design and stays closed until an
  authorization and an approved deployment record exist.
