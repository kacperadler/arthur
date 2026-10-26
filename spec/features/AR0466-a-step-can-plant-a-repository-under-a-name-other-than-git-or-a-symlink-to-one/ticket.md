# AR0466 - A step can plant a repository under a name other than `.git`, or a symlink to one, which the sweep does not see

```json
{
  "id": "AR0466",
  "title": "A step can plant a repository under a name other than `.git`, or a symlink to one, which the sweep does not see",
  "date": "2026-10-26"
}
```

## Description

F1 of AR0463 (spec/features/AR0463-a-merge-step-can-plant-a-nested-repository-whose-fsmonitor-runs-at-the-owner-s/findings.md).

- Kind: security
- Found by: 2026-10-26-worker-8e0940d9 (worker), 2026-10-26
- Where: `packages/delivery/src/merge-checks.ts`, `repositories`
- What: Git takes a folder holding `HEAD`, `objects/`, `refs/` and `config` as a repository's Git folder whatever its name, and follows a symlink in the path. A throwaway script (temporary folder, `git init --bare src/cache`, then `core.bare false`, `core.worktree` and `core.fsmonitor` set; and a symlink `src/link` to a repository elsewhere with `core.fsmonitor` set) printed `bare repository in a folder ran fsmonitor: true` for `git -C src/cache status` and `symlink to a repository ran fsmonitor: true` for `cd src/link && git status`. The sweep removes only entries named `.git`, so a step that writes either below the checkout's top still leaves a command for the owner's next git call in that folder.
- Suggestion: run the steps in a mount namespace where the checkout's subfolders are a copy (F1 of AR0457's route), or have the sweep also remove symlinks a step made and folders that hold a `HEAD` file and an `objects` folder; telling the owner to set `safe.bareRepository explicit` in `~/.gitconfig` closes the first case for his own git calls. Out: the `.git` sweep this ticket made.

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

- 2026-10-26: Source: F1 of AR0463
