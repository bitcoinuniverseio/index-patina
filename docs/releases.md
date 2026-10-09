# Versioning and releases

## What is versioned, and where it shows up

| Version | Source | Where a reader sees it |
| --- | --- | --- |
| Indexer version | `version` in `package.json`, read at runtime by `src/version.ts` | `GET /patina/status` as `indexer_version`, `GET /health`, and the `info.version` of `/openapi.json` |
| Parser version | The vendored protocol package's own version, as `patina/<version>` | `GET /patina/status` as `parser_version`, the `parser_version` column on every `blocks` row, and `index-patina status` |
| Specification hash | `spec_sha256` of the resolved deployment record | `GET /patina/status`, `index-patina status`, and `indexer_state` in the database |

`src/version.ts` walks up from the running module looking for the
`@bitcoinuniverse/index-patina` package manifest, so the same code reports the
right version whether it runs from `src` during a typecheck or from `dist/src`
after a build.

## Version scheme

Semantic versioning, with the boundary drawn where it matters for an indexer:

- **Major**: a change to the API contract that an existing client would notice,
  or a change that makes an existing database unreadable without operator action.
- **Minor**: new endpoints, new fields, new configuration, new commands.
- **Patch**: fixes that change no contract.

A change to the pinned protocol package is a separate axis. It is recorded in
`SOURCE-PROVENANCE.json`, it changes `PARSER_VERSION`, and it forces a `reindex`
on every existing database, because the parser version is written onto every
block row and the database refuses to open under a different one. Treat that as
at least a minor release and say so in the release notes, whatever else changed.

Nothing in this repository carries a version label in a name: no file, folder,
package, exported symbol or route. `PATINA_API_BASE_PATH` defaults to `/patina`,
not to a numbered path. This is the organization naming rule and
`docs/deviations.md` records why.

## Tag naming

`index-patina-<version>`, for example `index-patina-0.2.0`. The repository name
is in the tag because the organization's release tooling reads tags across many
repositories.

## Current release

| | |
| --- | --- |
| Tag | `index-patina-0.2.0` |
| Commit | `6ac59c7e46b5b8c3df3c8d2ab18287a01009ef66` |
| Tagged | 2026-08-02 |
| Published as a GitHub release | 2026-08-02, titled "PATINA indexer", not a prerelease |
| Protocol package | `@bitcoinuniverse/patina` 1.1.0, vendored and pinned by SHA-256 |

This is a real published release, not a snapshot of a branch. `docs.manifest.json`
therefore declares `lifecycle: stable` with `releasedRef: index-patina-0.2.0` and
`releaseVersion: 0.2.0`.

## The package is not published to a registry

`package.json` sets `"private": true`. There is no npm publish step and no
package to install from a registry. The consumable outputs of a release are:

- the Git tag and its GitHub release,
- the container image built from the repository at that tag.

If you want the code, clone the repository at the tag.

## Branches

`develop` is the working branch. `main` carries released work. CI runs on push
to either branch and on every pull request.

## Making a release

1. Land the work on `develop` and let CI pass.
2. Confirm the vendored protocol package is what you intend:
   `npm run verify:vendor`, and read `SOURCE-PROVENANCE.json`.
3. Run the full local gate: `npm run verify`.
4. Bump `version` in `package.json`. Nothing else needs editing; the runtime
   reads that one field.
5. Merge to `main`.
6. Tag the merge commit `index-patina-<version>` and push the tag.
7. Publish a GitHub release on that tag. Say plainly what changed, and if the
   protocol package version moved, say that a `reindex` is required.
8. Update `docs.manifest.json`: `releasedRef`, `releaseVersion`, and
   `lastVerified` with the exact commit and timestamp you verified at.

## Upgrading a deployment

See [operations.md](operations.md#upgrade-and-migration). The short version: a
schema migration is additive and automatic, and a protocol package or
specification change requires `index-patina reindex`, which the process tells
you about at startup rather than discovering silently.
