# Dogfooding

redfirst V0 was run on two real suites by the same author, both against the public [ServeRest](https://serverest.dev) demo store:

- [playwright-serverest-e2e](https://github.com/GuiNunesBR/playwright-serverest-e2e): 38 runs (18 API, 9 UI, 9 accessibility, setup and teardown), 28 TypeScript files linted.
- [cypress-serverest-e2e](https://github.com/GuiNunesBR/cypress-serverest-e2e): 36 tests (same scenarios), 38 TypeScript files linted.

Date: 2026-11-12. Neither suite was changed for this run; the findings below are reported as they came out.

## `redfirst lint`

| Finding | Suite | Verdict | What changed |
|---|---|---|---|
| TL002 on `src/helpers/evidencias.ts:80`: `new Promise` + `setTimeout` | Playwright | **False positive.** The timer rejects after 10 s: it is a deadline for a network capture, not a sleep. | Fixed in redfirst: TL002 now flags a `setTimeout` only when it resolves the promise. Regression fixture: `fixtures/playwright/good/timeout-guard.spec.ts`. |
| TL005 on `tests/e2e/auth.teardown.ts:7`: teardown has no assertion | Playwright | **True positive.** The teardown deletes the shared admin but never checks the response. If the delete fails, test data leaks into a shared environment and nobody notices. | Recommended for the suite: assert the delete status. |
| TL008 on `acessibilidade` specs: login assertion inside `if (perfil === 'cliente')` | both | **True positive, low risk.** The branch is fixed per generated test, so it is not flaky, but the shape hides setup inside the test. | Recommended for the suites: a `beforeEach` per profile. Documented in [limits.md](limits.md). |
| TL007 on `acessibilidade` specs: `.first()` on a selector from a list | both | **Accepted warning.** `.first()` waits for any row of a table to show up; it doesn't pick a row by position. The rule cannot tell the two apart. | Documented in [limits.md](limits.md). A reviewed `redfirst-disable-next-line TL007 -- reason` is the intended fix. |

Before the fix: 2 errors and 4 warnings across both suites, 1 of the errors a false positive. After: 1 error (true positive) and 4 warnings.

## `redfirst gate` over the real history

Each commit compared with the one before it.

| Change | Suite | Result | Verdict |
|---|---|---|---|
| New E2E scenarios plus a refactor of capture and cleanup (14 files) | Playwright | PASS | Correct: assertions only went up. No false positive on a large, real refactor. |
| README link | Playwright | PASS | Correct. |
| CI moved to the Playwright container image | Playwright | FAIL: G007, "a workflow step was removed" | Correct by design: the signal was accurate (setup and browser-install steps were removed on purpose). A human approves it. |
| CI actions updated | Cypress | FAIL: G007 | Correct by design. |
| Accessibility tests added | both | FAIL: G007 (new `test:a11y` script), G008 (new axe dependency); G006 warnings for the TL007/TL008 findings above | Correct by design: a new script and a new dependency need a human. The warnings match the lint findings. |
| Capture helper: the deadline starts after the action | Playwright | PASS | Correct. |
| Product sign-up marked `test.fail` while ServeRest is broken (ServeRest/front#42) | Playwright | PASS before the fix below; now FAIL: G004, G009 | It was a human decision, with a link, but the gate did not see it: `test.fail` turns a failing test green, which is what an agent trying to get green would reach for. Now a human approves it like a skip. |

What this changed in redfirst: a new `.fail` is now G004 and G009, like `.skip`. Earlier, G008 had no human override, so `--allow-dependencies` was added next to `--allow-protected`, and [protect-your-gate.md](protect-your-gate.md) shows how to wire both to a review label in CI.
