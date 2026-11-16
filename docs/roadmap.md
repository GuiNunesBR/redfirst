# Roadmap

V0 is judgment (the skill) plus deterministic enforcement (lint, gate, hooks, MCP server) plus a measured red-team corpus. V1, in this order:

0. **Verified healing.** Two MCP tools on top of `lint` and `gate`: `classify_failure` reads a Playwright report and trace and says what broke (locator, timing, data, contract, or a real product bug), and `verify_fix` runs the gate in heal mode on the repair. A failure corpus built by breaking the ServeRest suites on purpose measures both: right category, test green again, and no cheating let through.

1. **Mutation of network responses and state.** Change API responses during a test run (field removed, status swapped, value changed, empty list, delay) and check that the tests notice. Count a mutant as killed only when a test fails because of it, with retries off. Mutations happen on the client side (interception), so shared environments are not touched.
2. **Live red team.** An agent opens dozens of pull requests that try to get green by cheating, and we measure how many the gate blocks, next to the static corpus in `fixtures/redteam`.
3. **Three-arm benchmark.** The same tasks (write a test for a flow, fix a broken test, heal a locator, refuse to heal a real bug) run 3 to 5 times with no skill, with a third-party Playwright best-practices skill, and with redfirst. Measured: mutants killed, lint findings, reuse of page objects and fixtures, flakiness under `--repeat-each`, assertions preserved, cost and time. Variance and what did not improve are reported too.
4. **Registry checks for new dependencies** (G008): existence, age and downloads, to catch hallucinated packages.
5. **Follow assertion helpers** one level deep, closing the gap in `a28-assertion-moved-to-helper`.
6. **More adapters:** Cursor rules, Copilot instructions.
7. **More commands:** `audit` (whole-suite health), `debt` (skips, warnings and disables over time).
