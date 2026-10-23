# AR0330 - `git config` from a job rewrites the shared repository's config and the user's (AR0311 F2, confirmed)

```json
{
  "id": "AR0330",
  "title": "`git config` from a job rewrites the shared repository's config and the user's (AR0311 F2, confirmed)",
  "date": "2026-10-23"
}
```

## Description

`git config core.hooksPath <dir>`, `git config core.fsmonitor <program>`, `git config receive.denyCurrentBranch ignore`, also as `git -C <main> config …`, `git config --file <root>/.git/config …` and `git config --global …`, pass the guard; the first two make every later git call of Arthur in the main checkout (`arthur merge`, a status) run a program of the job's choice, after the job ended and outside its scope; the third lets a `push .` into `main` through that git refuses by default (see F3).

## Goal

`git config` in every form (`-C <main>`, `--file`, `--global`) is refused for a job, so the shared repository's config and hooks stay as they are; tested.

- Kind: risk

Evidence:
- `packages/core/src/git-writes.ts:4` (no `config` among the writing subcommands), `packages/core/src/worktree-guard.ts:128-137`, `:60` and `docs/deploy.md:34` (named as a limit)
- Found by: 2026-10-23-ar0320-security-check-4dea199b (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: in `gitCall`, `config` with any argument that sets or unsets (no `--get*`, `--list`, `-l`, `--show-origin`) and not `--worktree` or a `--file` outside the guarded places is a write of the main checkout: `refusal(place, place.root, "git config <key>")`; `--global` and `--system` likewise. Tests in `worktree-guard.test.ts`: each form above refused, `git config --get user.name`, `git config -l` and `git config --worktree x y` passing. Beside it (AR0324): Arthur's own git calls on a main checkout with `-c core.hooksPath=/dev/null -c core.fsmonitor=false`.
- `npm test` and `npm run check` pass.

## Scope

In:
- in `gitCall`, `config` with any argument that sets or unsets (no `--get*`, `--list`, `-l`, `--show-origin`) and not `--worktree` or a `--file` outside the guarded places is a write of the main checkout: `refusal(place, place.root, "git config <key>")`; `--global` and `--system` likewise. Tests in `worktree-guard.test.ts`: each form above refused, `git config --get user.name`, `git config -l` and `git config --worktree x y` passing. Beside it (AR0324): Arthur's own git calls on a main checkout with `-c core.hooksPath=/dev/null -c core.fsmonitor=false`.

## Decisions

- 2026-10-23: Source: F2 of AR0320
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
