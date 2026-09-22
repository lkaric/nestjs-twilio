# Contributing

Thanks for taking the time to contribute. This document covers the setup,
conventions and checks used in this repository.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Prerequisites

| Tool    | Version                    | Notes                                       |
| ------- | -------------------------- | ------------------------------------------- |
| Node.js | `>=20.19`                  | The pinned version lives in `.node-version` |
| pnpm    | pinned in `packageManager` | `corepack enable` picks it up automatically |
| Git     | any recent                 | N/A                                         |

```bash
corepack enable
git clone https://github.com/lkaric/nestjs-twilio.git
cd nestjs-twilio
pnpm install
```

`pnpm install` runs `lefthook install`, which wires the Git hooks.

> Migrating from an older checkout that used husky? Clear the stale hook path
> once: `git config --unset-all --local core.hooksPath && rm -rf .husky`.

## Available scripts

| Script                              | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `pnpm build`                        | Dual ESM + CJS build into `dist/`                |
| `pnpm test`                         | Unit tests (Vitest, mocked SDK)                  |
| `pnpm test:watch`                   | Unit tests in watch mode                         |
| `pnpm test:coverage`                | Unit tests with coverage                         |
| `pnpm test:integration`             | Live-API suite: requires real credentials        |
| `pnpm type-check`                   | `tsc --noEmit`                                   |
| `pnpm lint` / `pnpm lint:fix`       | oxlint                                           |
| `pnpm format` / `pnpm format:check` | Prettier                                         |
| `pnpm check:package`                | Build, then `publint --strict` and `attw --pack` |

## Before you open a pull request

Run what CI runs:

```bash
pnpm lint && pnpm format:check && pnpm type-check && pnpm test && pnpm check:package
```

The `pre-push` hook already runs `type-check` and `test` for you.

## Branch naming

`<type>/<short-description>`, using the same types as the commit convention,
for example `feat/webhook-guard`, `fix/options-validation`,
`docs/migration-guide`.

## Commit messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/).
`commitlint` enforces this in the `commit-msg` hook, and **semantic-release
derives the next version number directly from your commit types**, so the type
you choose determines the release.

```
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`chore`, `ci`, `build`, `revert`.

| Type                                             | Release    |
| ------------------------------------------------ | ---------- |
| `feat`                                           | minor      |
| `fix`, `perf`                                    | patch      |
| `BREAKING CHANGE:` footer, or `!` after the type | major      |
| everything else                                  | no release |

Subject: imperative mood, no trailing period, not Start-Case/PascalCase/UPPER-CASE.

```
feat(webhook): validate signatures behind a reverse proxy

Reconstruct the signed URL from X-Forwarded-Proto and X-Forwarded-Host so
validation succeeds when the app sits behind a load balancer.

Closes #81
```

A breaking change:

```
feat(module)!: flatten client options onto the module options object

BREAKING CHANGE: `options: { region }` is now `region` at the top level.
```

## Code conventions

- **TypeScript is strict.** `any`, non-null assertions and unchecked casts are
  rejected in review. Use `unknown` and narrow explicitly.
- **Every exported symbol is public API.** Anything exported from `lib/index.ts`
  is covered by semver. Non-additive changes to an exported signature require a
  major release and must say so in the commit footer.
- **Document exports.** Every public symbol carries JSDoc with an `@example`;
  this is what shows up on hover in a consumer's editor.
- **Import the `twilio` package root** in runtime code. Deep paths such as
  `twilio/lib/rest/Twilio` are not a stable entry point. Import them for types
  only, with `import type`.
- **Formatting is not a review topic.** Prettier runs in the `pre-commit` hook.

## Tests

Unit tests live in `lib/__tests__/` and mock the Twilio SDK: `pnpm test` must
never hit the network, so anyone can run the suite without credentials.

A test must fail if the behaviour it covers regresses. Tests that assert on
implementation detail or that would still pass with the feature deleted will be
sent back.

The live suite (`pnpm test:integration`) makes real API calls and costs real
money. It is not part of CI on pull requests; it runs only via manual
`workflow_dispatch`. Running it locally requires:

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_TARGET_PHONE_NUMBER=
```

Copy `.env.example` to `.env` to get started.

## Continuous integration

Every pull request runs `.github/workflows/ci.yml`:

- **lint**: oxlint plus a Prettier formatting check
- **type-check**: `tsc --noEmit`
- **test**: Vitest on Node 20.19, 22.12 and 24
- **build**: dual build, asserting both module formats emit and that
  `emitDecoratorMetadata` survives (Nest DI breaks silently without it)
- **package**: `publint --strict` and `attw --pack`

These report into a single required check named **CI**.

Pull requests are also reviewed automatically by CodeRabbit, configured in
[`.coderabbit.yaml`](./.coderabbit.yaml). Its comments are advisory. A human
approval is what merges a pull request.

## Releases

Maintainers only. Releases are automated: merging to `master` triggers
`.github/workflows/release.yml`, which re-verifies from a clean checkout and
then runs semantic-release to determine the version, update `CHANGELOG.md`,
tag, publish to npm with provenance, and create the GitHub release.

There is no manual version bump. To preview what the next release would be, run
the workflow with `dry-run` enabled.

## Reporting issues

**Bugs**: include a minimal reproduction, plus the versions of
`nestjs-twilio`, `@nestjs/common`, `twilio` and Node.js, and the full error with
stack trace.

**Features**: describe the use case first, then the proposed API. Explain what
you tried instead and why it was not sufficient.

Never paste real Account SIDs, auth tokens or API keys into an issue.

## Questions

Open a [discussion](https://github.com/lkaric/nestjs-twilio/discussions).
