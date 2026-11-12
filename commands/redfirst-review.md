---
description: Terse senior-SDET review of the test changes in the current diff, a file or a PR
argument-hint: "[file | PR number | base branch]"
---

Review the test changes in $ARGUMENTS (default: the current diff against the main branch).

1. If redfirst is installed, run `npx redfirst lint` on the changed test files and `npx redfirst gate --base <base>` first. Every error they report is a finding.
2. For each changed or added test, answer: what bug would this catch? If none, that is a finding.
3. Check:
   - isolation: own data, own cleanup, no order dependence, parallel-safe;
   - selectors: role, label or test id; no position, XPath or long CSS chains;
   - layer: could the API or a contract check prove this more cheaply?
   - missing negative cases where the risk is real (invalid input, no permission, empty state);
   - weakened checks: removed assertions, presence-only matchers, changed expected values, new skips;
   - the expectation itself: a test that faithfully encodes an unsafe or contradictory rule is still a problem. Flag it for a human.
4. Output one finding per line, most severe first:
   `file:line — rule or impact — fix`
5. End with one line: `Verdict: approve | request changes — <reason>`.

No praise, no summary of what the code does.
