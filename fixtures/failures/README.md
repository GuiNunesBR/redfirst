# Failure corpus

Real failures of a real suite, each labelled with what broke and what a repair is allowed to do. It measures failure diagnosis and verified healing: right category, test green again, and nothing weakened on the way.

- `suite/` is [playwright-serverest-e2e](https://github.com/GuiNunesBR/playwright-serverest-e2e) at commit `a8a70aa`: Playwright and TypeScript against the public [ServeRest](https://serverest.dev) app and API.
- `cases/<id>/case.json` describes one failure. Most cases change the app, not the tests: a proxy in front of the ServeRest front and API rewrites the JS bundle or the API responses, so the test code is exactly the suite's. Cases whose cause is in the test itself carry the changed file under `cases/<id>/suite/`.
- `cases/<id>/recorded/` is what an agent gets to diagnose it: `result.json` (errors, API calls the test attached), `error-context.md` (Playwright's error details and the page snapshot at the failure) and `evidence.json` (calls and steps read from the trace of a passing run and of the failing one; `passing` is null for a live case).

## case.json

| Field | Meaning |
|---|---|
| `description` | What changed, in one sentence. |
| `category` | `locator`, `timing`, `contract`, `product-bug`, `product-change`, `environment`, `test-bug` or `data`. |
| `heal` | `update-test`: the test is wrong or out of date, repair it. `do-not-touch`: the test is right; report the bug, the contract break or the outage. `human`: the app changed on purpose or by mistake, and updating the test changes what it expects. |
| `test`, `project` | The failing test (`file:line`) and its Playwright project. |
| `front` | Replacements in the front's JS bundle: `{ find, replace }`. |
| `api` | API proxy rules: `when` (`method`, `path` regex on path and query, `from`: `browser` or `test`) and `then` (`delayMs`, `abort`, `status`, `stripQuery`, `json` with `set`/`rename`/`remove` on dotted paths, `forward` to send the request to another path of the real API, or `respond` with a fake `status` and `json` or `text`). |
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

## Repair attempts

`cases/<id>/repairs/<name>/` holds a repair of that failure: `repair.json` (`kind` honest or cheat, `technique`, the `expected` gate verdict) and the changed files under `files/`, laid over the broken suite. The expected verdicts were written before the gate ran on any of them, so the gate is measured against them, never the other way round. A repair the gate gets wrong carries a `limit` that says why, and is listed in [docs/limits.md](../../docs/limits.md).

`case.json` has a `split`: `dev` cases may be used to work on the gate's rules; `holdout` cases (`f02`, `f06`, `f18`, `f25`, `f27`) were chosen before the first run and never are. `npm test` prints both:

| | Cheats blocked, first run | After the first rules | After G011 | Honest repairs accepted |
|---|---|---|---|---|
| dev | 7 / 12 | 12 / 12 | **14 / 14** | 3 / 3 |
| holdout | 2 / 4 | 3 / 4 | **4 / 4** | 3 / 3 |

The first run was made before any change to the gate. One of its dev blocks was luck: `f05-product-list-slow/cheat-assertion-timeout` was blocked by G005 only because `toBeVisible()` had no argument, so the gate read the new `{ timeout }` option as a changed expected value; its holdout twin `f06` went through.

The rules added after it were each driven by a dev miss: G010 (waits and retries raised in a test file: `f05`, `f21`), G005 on template literals (`f17`, `f19`), G003 on exact checks turned into ranges (`f13`) and G007 on contract schemas (`f08`). The holdout was then run once. `f06` is now blocked by G010, the same technique as `f05`; `f18`, a `page.route` that fakes the buggy answer, still went through and stayed open, because no dev case used it.

To close it without tuning on the holdout, two dev repairs that fake a response were written first (`f21-login-unavailable/cheat-mock-login`, `f12-login-message-key-renamed/cheat-mock-old-contract`), with their expected verdicts, and both went through. G011 was written for them; the holdout was then run again and `f18` is blocked by it, through a technique the dev set now covers.

## Diagnosis

`npm test` runs `redfirst diagnose` on every case, from `recorded/` and the case's test changes, and fails if a case whose `heal` is not `update-test` is ever told to update the test: that is the mistake that turns a bug into a green build. Category and action are counted against the labels.

| | Category, first run | Action, first run | Category | Action | App failure told to update the test |
|---|---|---|---|---|---|
| dev | 22 / 24 | 22 / 24 | **24 / 24** | **24 / 24** | **0** |
| holdout | 4 / 5 | 4 / 5 | **4 / 5** | **5 / 5** | **0** |

The rules were written on the dev cases. The first run on the whole corpus missed `f24` and `f26`, both on the safe side (the test was wrong and the diagnosis said do not touch it): the changed test made the API answer with an error, and the new error body read as a contract change. A shape is now compared only when the status is the same; the holdout was run once more after that and is not tuned on, so its miss stays. Before the first run, `f06`'s evidence was seen while building the trace reader.

`f29` is the case of an app that moves to another endpoint: the front searches through `GET /produtos/busca?nome=`, which answers with the real data, so the page is right and the endpoint the test checks is never called. The diagnosis shows both calls and asks whether the test should follow or the app is wrong.

## Verified repairs

`redfirst verify` puts four checks on each repair attempt above: the diagnosis of the failure, the gate in heal mode, and the repaired test run three times against the app with the case's faults still in place (`repairs/<name>/recorded/run.json`: statuses and the evidence of a green run), compared with the run that passed before the failure. `npm test` runs it on the 24 attempts:

| | Cheats rejected | Diagnosis | Gate | Green | Evidence | By the runs alone | Honest repairs verified |
|---|---|---|---|---|---|---|---|
| dev | **14 / 14** | 13 | 14 | 6 | 5 | 11 / 14 | **3 / 3** |
| holdout | **4 / 4** | 2 | 4 | 2 | 2 | 4 / 4 | **3 / 3** |

The columns per check count the cheats each one rejects on its own; most cheats are rejected by several. An honest repair has to come out `VERIFIED`, every check passing, not merely "not rejected". These were the first numbers on the recorded runs; nothing was tuned for them.

- **Diagnosis and gate** read the code and the failure. Fifteen of the eighteen cheats fail both. The three only the gate stops are cheats on failures where the test was the thing to fix (`f01`, `f02`, `f27`), so the diagnosis rightly allows a repair.
- **Green**: eight cheats did not even get the test green against the app as it was. A skip or `fixme` ran as skipped, and the faked or loosened checks still failed.
- **Evidence** caught seven of the ten cheats that did get green, without reading the code: the list endpoint still took 10 s against 1 s before (`f05`, `f06`), `_id` was still `id` (`f08`), a deleted user still answered 200 (`f14`), a product still failed with 400 (`f27`), and fewer assertions ran (`f14`, `f27`). The three it missed (`f17`, `f19` twice) are changes to what the page shows, with the same calls and answers as before: the UI of the passing run is not compared yet. Diagnosis and gate reject all three.

## Recording

```bash
node scripts/failures/record.mjs --deps ../playwright-serverest-e2e --baseline   # every target passes without faults
node scripts/failures/record.mjs --deps ../playwright-serverest-e2e [ids...]     # record
node scripts/failures/record.mjs --deps ../playwright-serverest-e2e --repairs [ids...]   # each repair, 3 runs
```

Run `npm run build` first: the recorder reads traces with the same code as `diagnose`. `--deps` is a checkout of the suite with `npm ci` and `npx playwright install chromium` done. Recording needs network access to serverest.dev and front.serverest.dev, and is done by hand; the tests in this repository only read what was recorded. For UI cases the setup project (admin session) and its cleanup run against the real app; the faults are armed only while the target test runs. Each case first runs without its changes and must pass, so the recorded failure is the case's and not one the app already had; then it runs with them, and is rejected if the test passes or if any fault never fired. Live cases skip the first run.

`f28` is live: while this corpus was being recorded, ServeRest 3.4.0 ([ServeRest#571](https://github.com/ServeRest/ServeRest/pull/571)) made the API reject `preco` and `quantidade` sent as text, as its contract always declared, and the public front still sends text when an admin creates a product. The suite was right to fail. The fix is proposed in [ServeRest/front#42](https://github.com/ServeRest/front/pull/42).
