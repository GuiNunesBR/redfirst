# Rules

## testlint (`redfirst lint`)

`error` fails the run (exit 1). `warn` is reported, and fails only with `--strict`. PW = Playwright, CY = Cypress.

| ID | Name | Severity | Applies | Catches | Fix |
|---|---|---|---|---|---|
| TL000 | disable-without-reason | error | both | `redfirst-disable-next-line` without rule ids or without `-- reason`. The disable is not applied. | `// redfirst-disable-next-line TL007 -- why` |
| TL001 | floating-assertion | error | PW | A web-first matcher (`toHaveText`, `toBeVisible`, `toHaveURL`, …), `expect.poll`, `.resolves` or `.rejects` that is not awaited or returned. | `await expect(...)` |
| TL002 | hard-wait | error | both | `waitForTimeout()`, `cy.wait(<number>)`, `sleep()`, and `new Promise` whose `setTimeout` resolves it. A timer that only rejects (a deadline) is fine. | Wait for a condition: web-first assertion, `waitForResponse`, `cy.intercept` alias. |
| TL003 | focused-test | error | both | `.only` on a test or describe, `fit`, `fdescribe`. | Remove before committing. |
| TL004 | unexplained-skip | warn | both | `.skip`, `.fixme`, `xit`, `xdescribe`, or an inline `test.skip(cond, reason)` without an issue link (`#123`, `JIRA-1`, a URL) in the reason or in a comment on the same or previous line. | Link the issue that tracks it. |
| TL005 | no-assertion | error | both | A test (not skipped) with no `expect`, `assert`, `.should`/`.and`, or assertion helper (`verify…`, `check…`, `expect…`, `assert…`). | Assert what the feature produces. |
| TL006 | presence-only | warn | both | Every assertion is presence-type: `toBeVisible`, `toBeAttached`, `toBeDefined`, `toBeTruthy`, `toBeFalsy`, `not.toBeNull`, `should('exist')`, `should('be.visible')`. | Assert a value, text, URL, count or status. |
| TL007 | brittle-selector | warn | both | `.nth()`, `.first()`, `.last()` not anchored on `getByRole`/`getByTestId`/`getByLabel`/a `data-testid`/`data-cy` selector; XPath; `:nth-child`; CSS with 3+ combinators. | Role, label or test-id locators. |
| TL008 | conditional-test-logic | warn | both | An assertion inside an `if`, `switch`, ternary or `catch` branch of a test. | Make the test deterministic; split per case. |
| TL009 | legacy-selector-api | warn | PW | `$`, `$$`, `$eval`, `$$eval`, `waitForSelector`. | Locators and web-first assertions. |
| TL010 | cypress-async-misuse | error | CY | An `async` test that uses `cy`, `await cy…`, or `const x = cy.get(...)`. | `.then()` or aliases. |
| TL011 | swallowed-failure | error | both | `.catch(() => {})` (or returning `null`/`undefined`/`false`) on a chain that starts at `page`, `expect` or `cy`; a `try` around an assertion whose `catch` does not rethrow. | Let the failure surface. |
| TL012 | tautological-assertion | error | both | An assertion on constants (`expect(true).toBe(true)`, `expect(1).toBeTruthy()`, `assert(true)`) or on a value against itself (`expect(x).toBe(x)`). | Assert something the product produced. |

Framework detection: Playwright when the file imports `@playwright/test`, or uses `test.describe`/`test.use`/`test.step`, or a test callback destructures fixtures; Cypress when the file uses `cy`, lives under `cypress/`, or ends in `.cy.ts`. Override with `--framework pw|cy` or `"framework"` in the config.

### Configuration

`.redfirstrc.json` in the working directory (or `--config <file>`):

```json
{
  "rules": { "TL007": "error", "TL009": "off" },
  "include": ["specs/**/*.ts"],
  "exclude": ["**/legacy/**"],
  "framework": "playwright"
}
```

## gate (`redfirst gate`)

Compares the tests at `--base` (a git ref, or `--base-dir`) with `--head` (a ref, the working tree by default, or `--head-dir`). Tests are matched by file and full title (`describe › test`).

| ID | Name | Severity | Fails when |
|---|---|---|---|
| G001 | test-removed | error | A test at base is missing at head. `--allow-removal` accepts it after review. |
| G002 | assertions-decreased | error | A test has fewer assertions, or fewer assertions that always run (one moved behind an `if`, ternary, `catch` or `&&`). |
| G003 | assertion-weakened | error | A check on the same subject went from strong to presence-only (`expect(total).toHaveText('x')` → `expect(total).toBeVisible()`). When the subject changed too, it fires if more value checks were lost than assertions were removed. |
| G004 | skip-or-only-introduced | error | A test gained `.skip`, `.fixme` or `.only`, directly or through its describe. |
| G005 | expected-value-changed | warn; error with `--mode heal` | Same subject, same matcher, different literal expected value (`toBe(201)` → `toBe(200)`). Healing must never change what is expected. |
| G006 | new-lint-findings | same as the lint rule | A lint finding that exists at head but not at base, in a changed file. Pre-existing debt is ignored. |
| G007 | protected-file-changed | error | A change to test/lint/TS config, `.redfirstrc.json`, CI workflows, `CODEOWNERS`, `.claude` settings or hooks, the redfirst hooks, or npm scripts. Names the specific signal when it finds one: retries or a timeout increased, `forbidOnly` removed, a new test filter, a rule turned off, a workflow step removed, `continue-on-error` or `|| true` added. `--allow-protected` is the human override. |
| G008 | new-dependency | error | A dependency added or changed in `package.json`, or a lockfile changed without one. `--allow-dependencies` is the human override. |
| G009 | disable-introduced | error | A new `redfirst-disable`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, or a new skip/fixme call, in a changed file. |

Strong vs weak: weak is the TL006 presence list; everything else that checks a value or state is strong. Unknown matchers and assertion helpers count as strong.

Assertions are aligned between base and head by their subject (what is checked: `page.getByTestId('total')`, `response.status()`, `cy.get('[data-cy=status]')`), so an assertion inserted or removed elsewhere in the test does not shift the comparison.

`--strict` turns warnings into failures. Output ends with `gate: PASS` or `gate: FAIL (n errors, m warnings in k files)`.
