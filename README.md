# redfirst

[![CI](https://github.com/GuiNunesBR/redfirst/actions/workflows/ci.yml/badge.svg)](https://github.com/GuiNunesBR/redfirst/actions/workflows/ci.yml)

**A green test that can't fail is a lie.**

redfirst makes AI coding agents write, review and repair automated tests that can fail for the right reason. It is a short agent skill, a test linter and a gate for Playwright and Cypress suites: judgment before the code, enforcement after it, and nothing weakened to get green.

## The problem

Agents are good at getting tests green. Not always for the right reason:

- a test that clicks through a flow and asserts nothing, or only that something is visible;
- a "healed" test that now expects the wrong value, because that's what the app returns;
- an assertion that is deleted, skipped, wrapped in a `try/catch`, or moved behind an `if`;
- retries or timeouts raised in the config, a CI step set to continue on error, a lint rule turned off.

Each of these turns a red build green without fixing anything. Knowing the Playwright API doesn't prevent them. Judgment and a guard that the agent cannot switch off do.

## What you get

| Piece | What it does |
|---|---|
| [`skills/redfirst/SKILL.md`](skills/redfirst/SKILL.md) | A ladder the agent climbs before writing a test, hard rules, a healing protocol and an output contract. Framework-agnostic. |
| [`AGENTS.md`](AGENTS.md) | The same rules, compact, for agents that read a rules file. |
| `redfirst lint` | 13 deterministic rules (TL000–TL012) for Playwright and Cypress test files, using the TypeScript AST. |
| `redfirst gate` | Compares the tests at a base and a head and fails when the change weakens them, or touches the files that decide whether tests run (G001–G009). |
| [`hooks`](hooks) | Agent hooks: block edits to protected files; lint every test file the agent edits and send the errors back. |
| `redfirst mcp` | An MCP server with `lint` and `gate` as tools, for any agent that speaks MCP. |
| Plugin manifests | Install the skill, the command and the hooks as a plugin in Claude Code, Codex or Grok Build. |
| [`commands/redfirst-review.md`](commands/redfirst-review.md) | A terse senior-SDET review of a test diff. |

Everything runs offline. No telemetry, no network, no LLM calls.

## Quick start

redfirst is not on npm yet. Install the packaged tarball from the [latest release](https://github.com/GuiNunesBR/redfirst/releases/latest) (it ships the built CLI, so no install script has to run):

```bash
npm i -D https://github.com/GuiNunesBR/redfirst/releases/download/v0.1.0/redfirst-0.1.0.tgz
npx redfirst lint                         # lints tests/, cypress/ and e2e/
npx redfirst gate --base origin/main      # compares your working tree with main
```

Or build it yourself: clone the repository, run `npm ci && npm run build && npm pack`, and install the `.tgz` it creates.

### For the agent

The repository is also a plugin: the skill, the review command and the hooks in one install. The hooks need `node` on the PATH; the lint hook uses the redfirst installed in the project (the step above) and stays silent without it.

| Agent | Install |
|---|---|
| Claude Code | `/plugin marketplace add GuiNunesBR/redfirst`, then `/plugin install redfirst@redfirst` |
| Codex | `codex plugin marketplace add GuiNunesBR/redfirst`, then `codex plugin add redfirst@redfirst`; review and trust the hooks in `/hooks` |
| Grok Build | Reads Claude Code marketplaces and plugins: add this repository as a source under `[[marketplace.sources]]` in `~/.grok/config.toml`, then install redfirst from the Marketplace tab in `/plugins` |
| Anything else | Copy [`AGENTS.md`](AGENTS.md) to the project root; most agents read it |

Without the plugin, copy the pieces into the project:

```bash
mkdir -p .claude/skills .claude/commands
cp -r node_modules/redfirst/skills/redfirst .claude/skills/
cp node_modules/redfirst/commands/redfirst-review.md .claude/commands/
```

and merge [`hooks/settings.example.json`](hooks/settings.example.json) into `.claude/settings.json`.

The same hook scripts serve the three agents: they read the edited file from `tool_input.file_path` (Claude Code, Grok Build) or from the `apply_patch` text (Codex), and block with exit code 2.

### Lint

```text
$ npx redfirst lint tests/cart.spec.ts
tests/cart.spec.ts:6:5  error  TL001  toHaveText() is not awaited, so its failure is lost. [cart › adds an item]
tests/cart.spec.ts:7:11  warn   TL007  .nth() picks an element by position. [cart › adds an item]

lint: FAIL (1 error, 1 warning in 1 file)
```

Options: `--format text|json|github` (GitHub annotations), `--strict` (warnings fail), `--config <file>`, `--framework pw|cy`. Exit codes: `0` clean, `1` violations, `2` usage or internal error.

### Gate

```text
$ npx redfirst gate --base origin/main
tests/cart.spec.ts:6:1  error  G006  New TL001: toHaveText() is not awaited, so its failure is lost. [cart › adds an item]
tests/cart.spec.ts:7:1  warn   G006  New TL007: .nth() picks an element by position. [cart › adds an item]
tests/cart.spec.ts:10:1  error  G003  toHaveText on page.getByTestId('total') became toBeVisible, which only checks presence. [cart › adds an item]
tests/cart.spec.ts:15:1  warn   G005  Expected value of toBe on response.status() changed: 201 -> 200. Needs a human decision. [cart › creates the order]

gate: FAIL (2 errors, 2 warnings in 1 file)
```

`--mode heal` makes G005 an error: healing must never change what is expected. `--base-dir`/`--head-dir` compare two folders instead of git refs. Human overrides, after review: `--allow-removal`, `--allow-protected`, `--allow-dependencies`.

### MCP server

`redfirst mcp` serves `lint` and `gate` as read-only tools over stdio, for the project in the directory it starts in. The model of the agent does the reasoning; the server only runs the checks, offline.

```bash
claude mcp add --scope project redfirst -- npx --no redfirst mcp    # Claude Code (Grok Build reads it too)
codex mcp add redfirst -- npx --no redfirst mcp                     # Codex
```

`--no` keeps npx from downloading a package with that name from the registry: the server must come from the project's own install. The gate tool has no override options. Allowing a removed test, a protected file or a new dependency stays a human decision on the command line.

On pull requests, run it as a required check and protect the files it guards: see [docs/protect-your-gate.md](docs/protect-your-gate.md). A gate that the agent can edit is not a gate.

## The ladder

0. Is the expectation itself right? A test can enshrine a bad rule.
1. Is a test needed, or does a cheaper layer already cover the risk?
2. Is there already a fixture, page object or similar test?
3. Right layer: unit, contract or API first; UI only for what only the UI shows.
4. Stable handle: role, label or test id.
5. Can it fail? Name the bug it catches; assert a value, not presence.
6. Independent: own data, own cleanup, any order.
7. Smallest proof.

## Rules

Full tables in [docs/rules.md](docs/rules.md).

| Lint | | Gate | |
|---|---|---|---|
| TL001 | floating assertion | G001 | test removed |
| TL002 | hard wait | G002 | assertions decreased (or moved behind a condition) |
| TL003 | `.only` | G003 | assertion weakened |
| TL004 | skip without issue link | G004 | skip or only introduced |
| TL005 | no assertion | G005 | expected value changed |
| TL006 | presence-only | G006 | new lint findings (ratchet) |
| TL007 | brittle selector | G007 | protected file or npm script changed |
| TL008 | conditional test logic | G008 | new dependency |
| TL009 | legacy selector API | G009 | disable or skip introduced |
| TL010 | Cypress async misuse | | |
| TL011 | swallowed failure | | |
| TL012 | tautological assertion | | |
| TL000 | disable without reason | | |

## Measured: the red-team corpus

[`fixtures/redteam`](fixtures/redteam) holds 28 changes that try to get green by cheating (delete a test, comment out an assertion, weaken a matcher, change the expected value, skip, `.only`, tautology, swallow with `try/catch` or `.catch`, hide the assertion behind an `if`, add a sleep, raise retries, remove `forbidOnly`, edit CI, change the npm script, `@ts-ignore`, a new dependency, turn a rule off, rename or delete the test, Cypress variants, move the check into a helper) and 10 legitimate changes that must pass (fix a locator, add a test or an assertion, strengthen a matcher, extract a helper, update data, edit a comment, rename a test). `npm test` runs the corpus and prints these numbers:

| | Result |
|---|---|
| Adversarial changes flagged | **27 / 28** |
| Adversarial changes blocked (gate fails) | **26 / 28** |
| Legitimate changes wrongly blocked | **1 / 10** (renaming a test, documented) |

The two that are not blocked: changing an expected value in `review` mode is a warning by design (blocked in `--mode heal`), and an assertion moved into a helper and weakened there is not followed in V0. These are numbers on a corpus written by the author, not on real agent pull requests; the live red team is on the [roadmap](docs/roadmap.md).

The tool was also run on two real suites. Findings, false positives and what changed because of them are in [docs/dogfooding.md](docs/dogfooding.md).

## Limits

- Static analysis only: redfirst reads the code; it does not run the tests or the app.
- Tests are matched by title, so a renamed or moved test shows up as removed.
- Assertions inside helper functions are not followed; a `verify…`/`check…` call counts as one opaque assertion.
- A gate guards the integrity of the tests, not the correctness of the requirements. A rule that was wrong on purpose passes every validator. That is why the skill starts at rung 0 and the review command asks a human to look at the expectation.
- The hooks and the gate are advisory unless the repository enforces them with CODEOWNERS and branch protection.

More in [docs/limits.md](docs/limits.md).

## Roadmap

Mutation of network responses and state, a live red team with an agent opening cheating pull requests, a three-arm benchmark (no skill, third-party Playwright skills, redfirst), registry checks for new dependencies, following helpers, more adapters. Details in [docs/roadmap.md](docs/roadmap.md).

## Prior art

- **Playwright's test agents** (planner, generator, healer) write and repair tests. redfirst does not replace them; it is the guard around what they change.
- **Playwright best-practice skills for agents** (for example from Currents and TestDino) teach the API. redfirst focuses on judgment and enforcement instead.
- **playwright-mutation-gate** inverts each test's main assertion to check that the test can fail. Same question, different method.
- **ponytail**, an agent skill for writing less code, inspired the format: a short opinionated skill, commands, hooks and a benchmark.

## Development

```bash
npm ci
npm run typecheck
npm test          # unit tests, fixtures and the red-team corpus
npm run build
```

Every lint rule has a bad fixture (each violating line marked `// expect: TLxxx`) and a clean one; every gate rule has a unit test and a negative twin.

## License

[MIT](LICENSE)
