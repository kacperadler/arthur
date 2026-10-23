# AR0309 - CI on GitHub fails since 2026-10-21: merge tests have no git identity on the runner

```json
{
  "id": "AR0309",
  "title": "CI on GitHub fails since 2026-10-21: merge tests have no git identity on the runner",
  "date": "2026-10-23"
}
```

## Description

The `ci` workflow (`.github/workflows/ci.yml`, ubuntu-24.04) fails on every push to main since 907c613 (2026-10-21; last green 37791c8). The merges went in anyway: `.agents/harness/project.json` names no `"ci"` workflow (so the harness waited for a `macOS` one Arthur does not have) and Arthur's `.env` has no `H_GITHUB_ACTIONS_TOKEN`, so every outcome says `CI macOS: off`.

## Goal

- Kind: bug

Evidence (run 39943434586 annotations): `test/ci-wait-wake.test.ts:27`, `packages/delivery/test/auto-merge.test.ts:169,200,223`: `git merge ... failed: fatal: empty ident name (for <runner@...>) not allowed`. Locally the tests pass because this server's git has a user.name.

## Done means

- Every test that merges, commits or tags in a temporary repository sets its own identity (repo-local `git config user.name/user.email`, or `GIT_AUTHOR_*`/`GIT_COMMITTER_*` in that call's env), never relying on the global one; proven by running the full `npm test` with `HOME` pointed at an empty folder and `GIT_CONFIG_NOSYSTEM=1` (no global or system identity), which fails before and passes after.
- Production code that runs `git merge`/`commit` (arthur merge) is unchanged; if a real user without a git identity would hit the same error, findings.md says so.
- `.agents/harness/project.json` gets `"ci": "ci"` so the harness counts this repository's GitHub workflow.
- The `ci` workflow passes on the pushed branch on GitHub (run URL in the final message).
- `npm test` and `npm run check` pass.

## Scope

In:
- the failing tests and any shared test helper they use; `.agents/harness/project.json`.

Out:
- `H_GITHUB_ACTIONS_TOKEN`: the human sets it.

## Decisions

- 2026-10-23: The human noticed CI red for a long time; the coordinator opened this ticket (free hand on fixes) and holds Arthur merges until CI is green.
