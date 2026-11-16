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

## Measured

[`fixtures/failures`](../fixtures/failures) has 29 recorded failures of a real suite with their evidence. `npm test` diagnoses every one and fails if an app failure is ever told to update the test. Results are in the corpus README.

## Limits

- Rules, not understanding. The categories come from patterns in the evidence; a failure that fits none is `unknown`, and an unusual one can fit the wrong pattern. The confidence says how much the evidence supports it.
- The trace format is internal to Playwright and undocumented. The reader fails loudly when the fields it needs are missing, instead of returning empty evidence.
- The UI of the passing run is not compared, only its calls and steps. A layout or content change shows up through the failing step and the page snapshot, not as a diff.
- A product bug and an intended change look the same in the evidence. When the test expected a status or a number, the diagnosis leans to `product-bug`; when it expected a text that was reworded, to `product-change`. Both forbid changing the test.
- Playwright only for now. Cypress has no trace with the same evidence.
