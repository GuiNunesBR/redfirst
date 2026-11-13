# Protect your gate

A gate that the agent can edit is not a gate. If an agent can change `playwright.config.ts`, the CI workflow or `.redfirstrc.json`, it can raise retries, skip the step that fails, or turn the rule off, and get green without fixing anything. The hook and `redfirst gate` make those changes visible; the repository settings below make them impossible to merge without a human.

## 1. CODEOWNERS

Put this in `.github/CODEOWNERS` (replace the owners):

```
# Tests and the files that decide whether they run
/tests/                      @your-team/qa
/cypress/                    @your-team/qa
/playwright.config.*         @your-team/qa
/cypress.config.*            @your-team/qa
/.redfirstrc.json            @your-team/qa
/tsconfig*.json              @your-team/qa
/eslint.config.*             @your-team/qa
/package.json                @your-team/qa
/package-lock.json           @your-team/qa
/.github/workflows/          @your-team/qa
/.github/CODEOWNERS          @your-team/qa
/.claude/                    @your-team/qa
/.codex/                     @your-team/qa
/.grok/                      @your-team/qa
```

## 2. Branch protection on `main`

- Require a pull request before merging.
- Require review from Code Owners.
- Require status checks to pass: add the `redfirst` job below.
- Do not allow bypassing the above settings, and do not give an agent's token admin or bypass rights.
- Dismiss stale approvals when new commits are pushed, so an approval doesn't carry over to a later change.

## 3. Run the gate on every pull request

```yaml
name: redfirst

on: pull_request

jobs:
  redfirst:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: npm ci
      - run: npx redfirst lint --format github
      - run: >
          npx redfirst gate --base origin/${{ github.base_ref }} --format github
          ${{ contains(github.event.pull_request.labels.*.name, 'redfirst:approved') && '--allow-protected --allow-dependencies --allow-removal' || '' }}
```

The `redfirst:approved` label is the human override: a code owner reviews the protected change, adds the label, and re-runs the job. Restrict who can add labels if agents open pull requests in your repository.

## 4. Agent hooks

Installing redfirst as a plugin in Claude Code, Codex or Grok Build loads [`hooks/hooks.json`](../hooks/hooks.json). Without the plugin, merge [`hooks/settings.example.json`](../hooks/settings.example.json) into `.claude/settings.json` (Grok Build reads that file too):

- `pre-edit-protect.mjs` (PreToolUse) blocks edits to protected files and tells the agent to propose the change instead.
- `post-edit-lint.mjs` (PostToolUse) lints each test file the agent edits and sends the errors back to it.

A human who needs to edit a protected file in an agent session sets `REDFIRST_ALLOW_PROTECTED=1` in their own shell before starting it. The hook never mentions the variable to the agent.

The hooks run on the developer's machine and can be turned off there. They save round-trips; branch protection is what enforces.
