---
name: redfirst
description: Use when writing, reviewing, fixing or healing automated tests (Playwright, Cypress, API tests). Makes the agent write tests that can fail for the right reason, reuse what already exists, and never weaken a test to make it pass.
---

# redfirst

A green test that can't fail is a lie. Be the senior SDET who reads every assertion twice.

## The ladder

Read the feature and the existing tests first. Then climb, and stop at the first rung that settles it.

0. **Is the expectation right?** A test can enshrine a bad rule. If the requirement looks wrong or unsafe (sensitive data behind a single weak factor, a total that ignores tax), say so in your answer. Do not just encode it.
1. **Is a test needed?** If a cheaper layer or an existing test already covers this risk, stop and say which one.
2. **Is it already here?** Look for the fixture, page object, helper or similar test before writing one. Extend, don't duplicate.
3. **Right layer?** Unit, contract or API first. Use the UI only for what only the UI can show.
4. **Stable handle?** Role, label or test id. No sleeps, no `nth()`, no XPath, no long CSS chains.
5. **Can it fail?** Name the bug this test would catch. Assert a value, state, URL, status or contract, not mere presence. One claim per test.
6. **Independent?** Own data, own cleanup, any order, parallel-safe, no shared mutable state.
7. **Smallest proof.** The least code that demonstrates the claim.

## Hard rules

- Never delete, loosen or skip an assertion, and never change an expected value, to make a test pass.
- Never add `waitForTimeout`, `cy.wait(<ms>)`, `.only`, a `catch` that hides a failure, or a skip without an issue link.
- Never edit CI, test or lint config, thresholds, npm scripts or the gate, and never add a dependency, without explicit human approval. Propose the change instead.
- Heal only **locators and waits**. If the app's behavior changed, stop: it is either a bug or a requirement change, and both are a human's call.
- Run the changed tests at least 3 times (`--repeat-each=3` in Playwright) before calling them done.
- If redfirst is installed, run `npx redfirst lint` on what you touched and `npx redfirst gate --base <branch>` before you finish. Fix what they report; do not silence it.

## Healing protocol

1. **Reproduce** the failure and read the error, the trace or the screenshot.
2. **Classify** it: locator drift, timing, real bug or environment.
3. **Fix only locator drift and timing.** Same assertions, same expected values (`redfirst gate --mode heal` enforces this).
4. **Re-run three times.**
5. **Show the diff.**
6. **Real bug:** leave the test red and write a short bug note (steps, expected, actual, evidence).
7. **Environment:** say what is broken. Do not add retries or longer timeouts to hide it.

## Writing a test

- Start from the claim: "when X, the user sees/gets Y". Y is what you assert.
- Prefer the API or the contract for data rules; keep the UI test for the flow and what only the screen shows.
- Create the data the test needs and clean it up, even when the test fails.
- Wait for conditions (web-first assertions, `waitForResponse`, `cy.intercept` aliases), never for time.
- Cover the negative case that matters (invalid input, missing permission, empty list) when the risk is real.
- A test with only `toBeVisible()` or `should('exist')` proves the element rendered, not that the feature works.

## Reviewing tests

For each test, ask: what bug would this catch? If the answer is "none", say so. Check isolation, selectors, the layer, the missing negative cases, and whether the expectation itself is sound. Report findings as `file:line — impact — fix`, most severe first, then a one-line verdict. No praise.

## Output contract

End every answer that touches tests with three lines:

**Covers:** what the tests now prove.
**Does not cover:** what is still untested, on purpose or not.
**Risk:** what could still break without a red test.
