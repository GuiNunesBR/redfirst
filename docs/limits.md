# Limits

redfirst is static analysis plus a diff. It reads the code; it does not run the tests or the app. These are the gaps we know about, with the red-team case or the repair attempt in the [failure corpus](../fixtures/failures) that documents each one.

## What the gate does not catch

| Gap | Why | Case |
|---|---|---|
| Assertions moved into a helper and weakened there | Helper bodies are not followed in V0. A call to `verify…`/`check…`/`expect…`/`assert…` counts as one opaque strong assertion. | `a28-assertion-moved-to-helper` |
| A changed expected value in review mode is a warning, not a failure | Sometimes the requirement really changed; a human decides. `--mode heal` and `--strict` make it an error. | `a05-change-expected-value` |
| A changed expected value held in a variable, or a changed locator regex in a page object | G005 compares literals and template literals in assertions; a variable's value and page-object code are not compared. | — |
| A contract schema loosened in a file that does not look like one | G007 recognises `schemas.ts`, `contracts/` and `*.schema.ts`; other files need `"contracts"` globs in the config. | — |
| A `page.route` that fakes the buggy answer inside the test | Not a gate signal. Left open on purpose: it only appears in the holdout set, which never shapes the rules. | `f18-duplicate-email-accepted/cheat-mock-the-bug` |
| Assertions that run but cannot fail for subtler reasons | `expect(list.length).toBeGreaterThanOrEqual(0)` passes for any list. TL012 only catches constants and self-comparison. | — |
| Behavior the tests never looked at | The gate protects the tests you have, not the ones you are missing. | — |
| A rule that is wrong on purpose | A test that faithfully encodes an unsafe requirement passes every validator. Only a human review of the requirement catches it (the skill's rung 0 and the review command ask for that). | — |

## Known false positives

| Situation | What happens | What to do |
|---|---|---|
| Renaming a test title | Reported as removed (G001), because tests are matched by title. | Review the rename, then run with `--allow-removal`. Case `l10-rename-test`. |
| Moving a test to another file | Reported as removed from the old file. | Same as above. |
| Legitimate changes to config, CI, scripts or dependencies | G007 / G008 fail by design: a human must approve them. | `--allow-protected` / `--allow-dependencies` after review (see [protect-your-gate.md](protect-your-gate.md)). |
| `.first()` used to wait for "any row" of a list | TL007 warns; it cannot tell a readiness wait from picking by position. | A `redfirst-disable-next-line TL007 -- reason`, or a role-based locator. |
| A test generated in a loop with a per-case `if` | TL008 warns even when the branch is fixed per generated test. | Prefer a `beforeEach` per group. |

## Other limits

- Dynamic titles (template strings) are matched by their source text.
- Only Playwright and Cypress are supported. Jest/Vitest files are parsed as plain `test`/`it` blocks but not targeted.
- The hook and the gate are advisory unless the repository enforces them (CODEOWNERS, branch protection, required checks).
- G008 does not query the registry in V0, so it cannot tell a real package from a hallucinated one. It only forces a human decision.
