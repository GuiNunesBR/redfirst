# Diagnosing a failure

A red test is a question: is the test wrong, or is the app? An agent asked to get it green has an easy wrong answer: make the test agree with the app. `redfirst diagnose` (and the MCP tool `classify_failure`) answers the question with evidence first, and says what a fix may do before anyone touches the test.

```bash
npx playwright test --reporter=json --trace=retain-on-failure > red.json
npx redfirst diagnose --report red.json --passing green.json --base origin/main
```

- `--report`: the JSON report of the failing run. Its traces give the calls and steps.
- `--passing`: the JSON report of an earlier run where the same tests passed, recorded with `--trace=on` (for example the last green run on main). Without it nothing can be compared, and the diagnosis says so.
- `--base`: the git ref of that passing run. Test code changed since then (specs, page objects, helpers) is evidence too.
- `--format json` for tools.

It runs offline and reads only files: no LLM, no network.

## What it reads

From each trace (`trace.zip`):

- **Calls**: every fetch/XHR of the page and every request of the test. For each one it keeps the method, the endpoint (ids as `:id`, query values dropped), the status, the time, and the shape of the request and response bodies: keys and types, not the data. An error answer (4xx/5xx) keeps its text, because that is the app explaining itself. A page request that the test's own `route.fulfill` answered is marked as such.
- **Steps**: the test's actions and assertions, with their selectors, time and error.

Then it compares the failing run with the passing one, in order, up to where the failing run stopped:

| Change | Example |
|---|---|
| Endpoint replaced | The app called `GET /v2/people` where it used to call `GET /users`, and the answer has the same shape. |
| Status | `POST /produtos` answered 400 (passing run: 201), body `{"preco":"preco deve ser um número"}`. |
| Response or request shape | `POST /usuarios` response: `_id removed`, `id added (string)`. |
| Slower, or no answer | `GET /usuarios` got no answer before the test ended (passing run: 200 in 767 ms). |
| Faked | The page's `POST /login` was answered by the test, not the app. |
| Test code | `tests/e2e/login.spec.ts: - … admin.password + … admin.nome` |

## What it says

For each failed test:

- **diagnosis**: `locator`, `timing`, `contract`, `product-bug`, `product-change`, `environment`, `test-bug`, `data` or `unknown`, with a confidence and the reasons;
- **action**: `update-test` (the test is wrong or out of date: repair it), `do-not-touch` (the test is right: report it) or `human` (only a person can say whether the test should follow the app);
- **you may / you must not**: what a fix may change, and what it never may (expected values, timeouts and retries, skips, faked responses);
- **questions for a human**, and what the evidence **cannot tell**;
- a **bug report draft** when the app is at fault: steps, expected and actual, the calls with what was sent and answered, and what changed since the passing run.

The action is `update-test` only when the evidence points at the test (a locator that stopped matching while the app behaved as before, or test code that changed). Anything that points at the app, or at nothing in particular, is `do-not-touch` or `human`. A wrong `human` costs a question; a wrong `update-test` turns a bug into a green build.

## Verifying a repair

`redfirst verify` (MCP tool `verify_fix`) judges the repair after it is made:

```bash
npx playwright test tests/users.spec.ts --repeat-each=3 --trace=on --reporter=json > after.json
npx redfirst verify --base HEAD --failing red.json --passing green.json --report after.json
```

| Check | Fails when |
|---|---|
| diagnosis | The failure was diagnosed `do-not-touch` or `human` and the repair changed test code. A failure of the app that went away without touching the test passes. |
| gate | The gate in heal mode, from `--base` to the working tree, finds an error: an assertion removed or weakened, an expected value changed, a skip, a longer wait, a faked response, a protected file. |
| green | A run of the repaired test did not pass. Fewer than three passing runs (`--runs` to change) is `unknown`, not a pass. |
| evidence | In the green run, an answer came from the test's own `route.fulfill`; fewer assertions ran than in the last passing run; or the app still answers differently (status, shape, endpoint, slowness) and the test is green anyway. |

The verdict is `VERIFIED` only when all four pass, `REJECTED` when one fails, and `INCOMPLETE` when nothing failed but something could not be checked (no report of the repaired test, no trace, no diagnosis). `--base` is the ref the failing run ran on; `--green` is the ref of the passing run, when test code changed between the two.

`--accept-app-change` is the human override for a `human` diagnosis: someone decided the app changed on purpose, so the test may follow and the app may answer differently than before. It is not in the MCP tool, and it never lifts a `do-not-touch`.

## Measured

[`fixtures/failures`](../fixtures/failures) has 29 recorded failures of a real suite with their evidence. `npm test` diagnoses every one and fails if an app failure is ever told to update the test. Results are in the corpus README, with the 24 repair attempts, each run three times against the app with the failure still in place: `verify` rejects all 18 cheats and verifies all 6 honest repairs. The runs alone, without reading the code, reject 15 of the 18 cheats; the three they miss change only what the page shows.

## Limits

- Rules, not understanding. The categories come from patterns in the evidence; a failure that fits none is `unknown`, and an unusual one can fit the wrong pattern. The confidence says how much the evidence supports it.
- The trace format is internal to Playwright and undocumented. The reader fails loudly when the fields it needs are missing, instead of returning empty evidence.
- The UI of the passing run is not compared, only its calls and steps. A layout or content change shows up through the failing step and the page snapshot, not as a diff.
- A product bug and an intended change look the same in the evidence. When the test expected a status or a number, the diagnosis leans to `product-bug`; when it expected a text that was reworded, to `product-change`. Both forbid changing the test.
- Playwright only for now. Cypress has no trace with the same evidence.
