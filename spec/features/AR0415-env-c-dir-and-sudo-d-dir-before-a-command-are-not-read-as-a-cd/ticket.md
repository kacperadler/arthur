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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-25: Source: F1 of AR0332
