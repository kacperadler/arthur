# AR0099 - CI on GitHub is red: three tests need a git identity or a systemd user session

```json
{
  "id": "AR0099",
  "title": "CI on GitHub is red: three tests need a git identity or a systemd user session",
  "date": "2026-10-17"
}
```

## Description

GitHub Actions (`.github/workflows/ci.yml`, ubuntu-latest) has failed on main since 2026-10-16 19:49 (4e7fa62, AR0024 merged); every run since is red. Local `npm test` passes because this VPS has a git identity and a systemd user session; a fresh clone with an empty HOME (`env -i PATH=... HOME=<empty> CI=true npm test`) reproduces it: 3 of 353 fail. `ci-repro.log` in this folder is that run.

## Goal

`npm ci && npm run check && npm test` passes on a clean ubuntu-latest runner, and on this VPS with an empty HOME and no user session, so CI is green and means something.

- Kind: bug

## Done means

- `packages/core/test/machine.test.ts:100` (`git commit-tree` "Author identity unknown"): the test gives its own repositories an identity (as its other git calls or the core's do), never relying on the user's global config.
- `packages/core/test/job-control.test.ts:170` ("timed out waiting for the holder's end") and `:347` ("two continues at once…", `true !== false` at :364): each passes where `systemd-run --user` is unavailable, by the fallback the core already uses there, or is skipped with a stated reason only when the behaviour it checks cannot exist without a user session; the worker says which and why.
- Reproduced before and after with the command in Description, in a fresh clone; the result names the counts.
- The CI run on the branch's tip is green (`https://github.com/kacperadler/arthur/actions`); the worker reads its conclusion with `curl -s https://api.github.com/repos/kacperadler/arthur/actions/runs?branch=<branch>` (public, no token).
- `npm test` and `npm run check` pass locally as well.

## Scope

In:
- The three tests and anything in `packages/core` they show is wrong without a user session.

Out:
- The workflow file, except a change the fix proves necessary.

## Decisions

- 2026-10-17: Coordinator: found when the owner asked whether Arthur's CI is checked; it was not.
