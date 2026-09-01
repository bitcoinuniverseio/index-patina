# Provenance and the protocol boundary

## The rule this repository holds itself to

No protocol logic lives here. The entire consensus surface available to this
indexer comes from one package, `@bitcoinuniverse/patina`, imported through
`src/protocol.ts`, which is a re-export and nothing else. If a rule appears to be
missing from this repository, it belongs in the protocol package.

Anyone can check that claim in one file: open `src/protocol.ts` and see a list of
`export` statements from `@bitcoinuniverse/patina` and no rule of its own.

What comes from the package:

- frozen constants and the reason code registry
- the marker codec and scriptPubKey scanning
- identity derivations, commit-leaf construction and parsing, artifact ids and
  the attestation message
- SEED and KEEP validation and the default successor rule
- the deterministic state reducer `applyBlock`, and `replay`
- the event, artifact and state root encodings
- depth and tier computation
- deployment record loading and the founding window state machine

## `SOURCE-PROVENANCE.json`

The root file `SOURCE-PROVENANCE.json` is the machine readable record of that
boundary. It states, for one release of this indexer:

| Field | What it records |
| --- | --- |
| `component` | This package. |
| `implementation` | That this is an independently authored indexer, not a port or a fork. |
| `consensusSurface.package` and `.version` | The exact protocol package and version linked against. |
| `consensusSurface.resolution` | How npm resolves it: `file:vendor/bitcoinuniverse-patina-1.1.0.tgz`. |
| `consensusSurface.sourceRepository` and `.sourceCommit` | The protocol repository and the exact commit the vendored tarball was packed from. |
| `consensusSurface.vendoredTarball` | The tarball path, its SHA-256, the packed name and version, the specification SHA-256 inside it, and the script that checks all of them. |
| `consensusSurface.provides` | The itemized list of what the package decides, so a reviewer knows what to look for if they suspect a rule was restated locally. |
| `claims` | Four explicit negatives: no copied protocol logic, no reimplemented consensus rules, no external runtime evidence, no mock data in API responses. |
| `notes` | Where the boundary is subtle, in this repository's own words. |

### Why it matters

Three practical reasons, in order of how often they come up:

1. **An indexer that quietly restates a rule is the worst kind of bug.** It
   produces state that looks authoritative and disagrees with every other
   implementation. Naming the boundary, and making it one file, turns that from a
   code review problem into a five second check.
2. **A vendored dependency is a supply chain surface.** The tarball is committed
   to this repository, so it must be provable that the committed bytes are the
   bytes that were published. `SOURCE-PROVENANCE.json` records the SHA-256 and
   `scripts/verify-vendor.mjs` recomputes it.
3. **A protocol version is part of the data.** Every `blocks` row records the
   parser version that wrote it, and the database is bound to one specification
   hash. The provenance file is what connects a database on disk back to the
   exact rules that produced it.

### Verifying it

```sh
npm run verify:vendor
```

The script recomputes the tarball's SHA-256 and npm integrity, inspects the
packed package name, version and specification hash, and checks that both
`package.json` and `package-lock.json` resolve the dependency to that same
vendored file. It runs in CI on every push and pull request, and again inside
the Docker build.

Its output names both the recorded and the recomputed hash, so a mismatch is
visible rather than inferred:

```
vendor file        vendor/bitcoinuniverse-patina-1.1.0.tgz
recorded sha256    a53792688eaa37bfcb022baf48a67bf80206b4647f8ff8e9100b0cc15dbf4477
recomputed sha256  a53792688eaa37bfcb022baf48a67bf80206b4647f8ff8e9100b0cc15dbf4477
package.json dep   @bitcoinuniverse/patina: file:vendor/bitcoinuniverse-patina-1.1.0.tgz
vendor check ok
```

### Why the package is vendored rather than installed from a registry

The dependency resolves for anyone who clones this repository alone, with no
sibling checkout of the protocol repository at a matching relative path and no
registry access. That is also what lets the Docker image build from this
repository as its only build context.

## The two places the boundary is subtle

`SOURCE-PROVENANCE.json` records both in its `notes`, and they are worth reading
in full before reviewing this repository:

- **`src/facts.ts`** reads a block back through the same protocol package to
  recover storage details the state model does not carry, such as which input
  revealed the commit leaf. It makes no judgements of its own.
- **`src/store.ts`** recomputes aggregate counters when rebuilding a snapshot
  from SQL. That result is checked against the state root the reducer wrote for
  the tip block, so a disagreement stops the process instead of being served.

## Deviations

`docs/deviations.md` records, separately, every place this service had to make a
choice the protocol baseline leaves open, and states plainly that there are no
deviations from the baseline itself.

## The protocol itself

The specification, the JSON Schemas and the conformance vectors live in the
protocol repository, not here:

- Site: <https://bitcoinuniverseio.github.io/patina/>
- Repository: <https://github.com/bitcoinuniverseio/patina>

Do not restate protocol rules in this repository. Link to them.
