# AR0415 - `env -C <dir>` and `sudo -D <dir>` before a command are not read as a `cd`

```json
{
  "id": "AR0415",
  "title": "`env -C <dir>` and `sudo -D <dir>` before a command are not read as a `cd`",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0332 (spec/features/AR0332-git-dir-git-work-tree-git-index-file-before-git-are-not-read-as-git-dir-work-tree/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-10b542de (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:50-57` (`commandIndex` skips `-C`/`-D` with their value), `packages/core/src/worktree-guard.ts:142` (`dir` starts from `cwd` and only the `git -C` folders)
- What: `env -C ../../acme git checkout -- .` runs git in the main checkout, as `git -C ../../acme checkout -- .` does, which the guard refuses; the wrapper's folder is skipped as an option value and the command is judged from the job's `cwd`. `gitCall(["commit", "-m", "x"], ["env", "-C", "/x"]).chdirs` is `[]` (run with `node -e`); that the whole call then passes is an inference from those lines, not run. The same holds for `rm`, `mv` and the other writing commands after `env -C`/`env --chdir=`/`sudo -D`.
- Suggestion: in `judge`, resolve the folder of `env -C`/`--chdir` and `sudo -D`/`--chdir` among the words before the command and judge the command from there; a test with `env -C <main> git checkout -- .` and `env -C <main> rm README.md` refused.

## Goal

`env -C <dir>`/`env --chdir=<dir>` and `sudo -D <dir>`/`sudo --chdir=<dir>` before a command are read as a move into `<dir>` for that command, so a write there is judged where it runs; tested.

- Kind: security

## Done means

- In `judge`, the folder of those options among the words before the command is resolved and the command judged from it, for git and the writing commands alike. Tests in `worktree-guard.test.ts`: `env -C <main> git checkout -- .`, `env --chdir=<main> rm README.md` and `sudo -D <main> rm README.md` refused naming the main checkout; each fails on main.
- Both source files stay at 200 lines or under, or the worker raises the core budget by the lines needed (AR-D29) and says so.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- Other wrappers that change folder.

## Decisions

- 2026-10-25: Source: F1 of AR0332
- 2026-10-25: AR0415 approved under the owner's standing word (AR-D31); the owner: "always go with recommendation till the 8 am morning" (AR-D33)
