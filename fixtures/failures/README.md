# Failure corpus

Real failures of a real suite, each labelled with what broke and what a repair is allowed to do. It measures failure diagnosis and verified healing: right category, test green again, and nothing weakened on the way.

- `suite/` is [playwright-serverest-e2e](https://github.com/GuiNunesBR/playwright-serverest-e2e) at commit `a8a70aa`: Playwright and TypeScript against the public [ServeRest](https://serverest.dev) app and API.
- `cases/<id>/case.json` describes one failure. Most cases change the app, not the tests: a proxy in front of the ServeRest front and API rewrites the JS bundle or the API responses, so the test code is exactly the suite's. Cases whose cause is in the test itself carry the changed file under `cases/<id>/suite/`.
- `cases/<id>/recorded/` is what an agent gets to diagnose it: `result.json` (errors, API calls the test attached) and `error-context.md` (Playwright's error details and the page snapshot at the failure).

## case.json

| Field | Meaning |
|---|---|
| `description` | What changed, in one sentence. |
| `category` | `locator`, `timing`, `contract`, `product-bug`, `product-change`, `environment`, `test-bug` or `data`. |
| `heal` | `update-test`: the test is wrong or out of date, repair it. `do-not-touch`: the test is right; report the bug, the contract break or the outage. `human`: the app changed on purpose or by mistake, and updating the test changes what it expects. |
| `test`, `project` | The failing test (`file:line`) and its Playwright project. |
| `front` | Replacements in the front's JS bundle: `{ find, replace }`. |
| `api` | API proxy rules: `when` (`method`, `path` regex on path and query, `from`: `browser` or `test`) and `then` (`delayMs`, `abort`, `status`, `stripQuery`, `json` with `set`/`rename`/`remove` on dotted paths, or `respond` with a fake `status` and `json` or `text`). |
| `fix`, `note` | The repair a reviewer expects, or why there is none. |
| `live` | Not injected: a failure of the real app, recorded as it happened. |

Categories, by what a fixer may do:

| Category | Cause | heal |
|---|---|---|
| `locator` | The element is still there; its handle (test id, label) changed. | `update-test` |
| `test-bug` | A change to the test broke it. | `update-test` |
| `data` | The test's data collides with data on the shared API. | `update-test` |
| `timing` | The app is slower than the test waits. A performance regression, not a reason to raise timeouts. | `do-not-touch` |
| `contract` | An API response changed shape. | `do-not-touch` |
| `product-bug` | The app does the wrong thing. | `do-not-touch` |
| `environment` | The service is down or the connection drops. | `do-not-touch` |
| `product-change` | The app's visible behaviour changed; only a human can say whether the test should follow. | `human` |

The labels are the author's, like the red-team corpus. Several failures are hard on purpose: a renamed button and a slow login both surface as `O front não chamou POST /login`, because the suite's capture helper starts its deadline before the action.

## Recording

```bash
node scripts/failures/record.mjs --deps ../playwright-serverest-e2e --baseline   # every target passes without faults
node scripts/failures/record.mjs --deps ../playwright-serverest-e2e [ids...]     # record
```

`--deps` is a checkout of the suite with `npm ci` and `npx playwright install chromium` done. Recording needs network access to serverest.dev and front.serverest.dev, and is done by hand; the tests in this repository only read what was recorded. For UI cases the setup project (admin session) and its cleanup run against the real app; the faults are armed only while the target test runs. Each case first runs without its changes and must pass, so the recorded failure is the case's and not one the app already had; then it runs with them, and is rejected if the test passes or if any fault never fired. Live cases skip the first run.

`f28` is live: while recording this corpus, the public front started sending `preco` and `quantidade` as text when an admin creates a product, and the API rejects them. The suite was right to fail.
