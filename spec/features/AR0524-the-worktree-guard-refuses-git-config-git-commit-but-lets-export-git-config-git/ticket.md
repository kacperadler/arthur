# AR0524 - The worktree guard refuses `GIT_CONFIG_*=... git commit` but lets `export GIT_CONFIG_*=...; git commit` through

```json
{
  "id": "AR0524",
  "title": "The worktree guard refuses `GIT_CONFIG_*=... git commit` but lets `export GIT_CONFIG_*=...; git commit` through",
  "date": "2026-10-27"
}
```

## Description

F4 of AR0518 (spec/features/AR0518-a-token-from-the-env-file-never-appears-in-a-job-record-log-error-or-channel/findings.md).

- Kind: security
- Found by: 2026-10-27-worker-28470be0 (worker), 2026-10-27
- Where: `packages/core/src/git-writes.ts:10`
- What: in this job, `GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=commit.gpgSign GIT_CONFIG_VALUE_0=false ... git commit -q -am "..."` was refused with the guard's line "this git call reads config the guard does not (... GIT_CONFIG* ...)", while `export GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=commit.gpgSign ...; git commit -q -am "..."` in one bash call committed (81feccc2). The guard reads the assignments that prefix the git word only, so config set by `export` earlier in the same call, or in an earlier call of the shell, reaches git unseen: an alias or `core.hooksPath` the guard never checks.
- Suggestion: count `export`/`declare -x` of `GIT_CONFIG*`, `HOME` and `XDG_CONFIG_HOME` earlier in the call as set for each git call after it, and refuse; a persistent shell's earlier calls stay out of reach (the sandbox's matter). Out: the owner's own unsigned commits (AR-D184), which the guard could allow for `commit.gpgSign` and `tag.gpgSign` alone.

## Goal

The worktree guard judges git config set by `export` (or `declare -x`) earlier in the same bash call as it judges config set in front of the git word. Evidence: `packages/core/src/git-writes.ts:10` reads only the assignments that prefix `git`; in job 2026-10-27-worker-28470be0, `export GIT_CONFIG_COUNT=2 ...; git commit` committed (81feccc2) where the prefixed form was refused.

- Kind: security

## Done means

- `export GIT_CONFIG_COUNT=... ; git commit`, and the same with `HOME` or `XDG_CONFIG_HOME`, is refused with the prefixed form's line; a test covers each, and fails without the fix.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/git-writes.ts` and its test.

Out:
- Config exported in an earlier bash call of a persistent shell: the sandbox's matter, not the guard's.
- Job commits stay unsigned (AR-D184) through Arthur's own settings, unchanged.

## Decisions

- 2026-10-27: Source: F4 of AR0518
- 2026-10-28: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
