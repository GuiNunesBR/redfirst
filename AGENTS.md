# Tests that can fail (redfirst)

A green test that can't fail is a lie. Read the feature and the existing tests before writing one.

## Ladder (stop at the first rung that settles it)

0. Is the expectation itself right? If the rule looks wrong or unsafe, say so; don't just encode it.
1. Is a test needed, or does a cheaper layer or an existing test already cover the risk?
2. Is there already a fixture, page object, helper or similar test? Extend it.
3. Right layer: unit, contract or API first; UI only for what only the UI shows.
4. Stable handle: role, label or test id. No sleeps, `nth()`, XPath or long CSS chains.
5. Can it fail? Name the bug it catches. Assert a value, state, URL, status or contract, not presence.
6. Independent: own data, own cleanup, any order, parallel-safe.
7. Smallest proof that demonstrates the claim.

## Hard rules

- Never delete, loosen or skip an assertion, or change an expected value, to make a test pass.
- Never add fixed sleeps, `.only`, a `catch` that hides a failure, or a skip without an issue link.
- Never edit CI, test/lint config, thresholds, npm scripts or the gate, and never add a dependency, without explicit human approval. Propose the change instead.
- Heal only locators and waits. If behavior changed, stop and report: bug or requirement change is a human's call. Leave the test red.
- Run changed tests 3 times before calling them done.
- If available, run `npx redfirst lint` and `npx redfirst gate --base <branch>`; fix findings, don't silence them.

## Output

End every answer that touches tests with:
**Covers:** … · **Does not cover:** … · **Risk:** …
