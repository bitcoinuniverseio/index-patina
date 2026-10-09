# Contributing

## Before you write code

Read [docs/provenance.md](docs/provenance.md). One rule governs this repository
more than any other:

**No protocol rule lives here.** Every consensus decision comes from
`@bitcoinuniverse/patina` through `src/protocol.ts`, which is a re-export and
nothing else. A change that restates a rule locally will be rejected even when it
produces the right answer, because the next change will not.

If you believe a rule is wrong or missing, open it in the protocol repository:
<https://github.com/bitcoinuniverseio/patina>.

## Setup

```sh
npm ci
npm run verify        # vendor check, typecheck, build, test
```

Node.js 24.19.0 and npm 11.17.0, pinned in `package.json` `engines`, `.nvmrc`
and `.node-version`.

If `npm ci` fails while compiling `better-sqlite3`, use
`npm ci --ignore-scripts`. The package ships prebuilt binaries and the suite runs
against them.

## The gate

Every change must pass, locally, before it is pushed:

```sh
npm run verify:vendor
npm run typecheck
npm run build
npm test
```

`npm run verify` runs all four in that order. CI runs the same four plus an
`npm audit --omit=dev --audit-level=high` and an offline command line smoke test.

## Tests

Add or update tests for every changed behaviour. The suite needs no Bitcoin node:
it drives a synthetic regtest chain through the offline RPC client, so the real
resolver, the real reducer and the real store are all exercised. See
[docs/testing.md](docs/testing.md) for what each file covers and where a new test
most likely belongs.

Two kinds of change need particular care:

- **Anything touching the store or the reducer boundary.** Add a case to
  `test/replay.test.ts` or `test/reorg.test.ts` that proves the state root still
  reproduces.
- **Anything touching the API.** `test/api.test.ts` asserts that
  `/openapi.json` documents every registered route, so a new route without a
  document fails the suite.

## Style

- TypeScript, ES modules, strict compiler settings. No new runtime dependency
  without a reason that survives review; the service currently has two.
- Match the surrounding code. Comments explain why, not what.
- SQL stays in the portable subset described in
  [docs/data-model.md](docs/data-model.md). All DDL lives in `src/migrations.ts`.
- Every value that reaches SQL is bound. Where a query is assembled, only fixed
  fragments the code itself owns are concatenated; no caller-supplied value is
  ever interpolated into a statement.

## Documentation is part of the change

Any change to behaviour, configuration, the API, the schema, a workflow or the
build updates the documentation in the same pull request. A pull request that
changes an environment variable and not `.env.example` and
[docs/configuration.md](docs/configuration.md) is incomplete.

Style rules for prose in this repository:

- No em dash characters. Use commas, colons, periods or parentheses.
- Plain, direct writing. Short paragraphs. A table or a diagram beats three
  paragraphs.
- No placeholder sections, no "coming soon", no untested examples. If you cannot
  verify a claim, do not publish it.

## Branches, commits and pull requests

- `develop` is the working branch. Branch from it, and target it.
- One logical change per pull request. Say what changed and what you ran.
- CI runs on the self-hosted fleet. Never use a GitHub-hosted runner label
  (`ubuntu-latest`, `windows-latest`, `macos-latest`) in a workflow here.

## Security

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).

## Licence

MIT. By contributing you agree your contribution is licensed under it.
