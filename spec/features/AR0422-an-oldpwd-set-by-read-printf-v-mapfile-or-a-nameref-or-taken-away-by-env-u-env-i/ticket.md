# AR0422 - An `OLDPWD` set by `read`, `printf -v`, `mapfile` or a nameref, or taken away by `env -u`/`env -i`, is not seen

```json
{
  "id": "AR0422",
  "title": "An `OLDPWD` set by `read`, `printf -v`, `mapfile` or a nameref, or taken away by `env -u`/`env -i`, is not seen",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0333 (spec/features/AR0333-cd-pushd-with-no-operand-and-oldpwd-are-read-as-cd-home/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-9a6298d8 (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:99-100`, `:114-119`
- What: the guard follows OLDPWD through an assignment (`=`, `+=`), `export`/`declare`/`typeset`/`readonly`/`local`, `unset` but `-f`, each `cd`/`pushd`/`popd`, and a prefix assignment (also after `env`) before `cd`, a shell (`bash -c`, a heredoc) or `eval`, for what they run only. Not seen:
  - `read OLDPWD <<< <main>; cd -; rm README.md` sets it unseen, so `cd -` is read as the folder before [INFERENCE: from the code; not run].
  - `env -u OLDPWD bash -c 'cd -; rm README.md'` (or `env -i`) after `cd <main>; cd /tmp; cd -`: the inner bash has no OLDPWD, so its `cd -` fails and it removes main's README, while the guard moves the inner shell to `/tmp` [INFERENCE: from the code; not run].
  - A prefix before `find … -exec bash -c`, `xargs bash -c` or a script file: the command `find` or `xargs` runs is judged without the prefix.
  - A quoted `'~-'` is read as OLDPWD's folder though bash takes it as a folder named `~-` (shell-words.ts gives `~-` for both).
- Suggestion: treat a command that names `OLDPWD` as an operand of `read`, `printf -v`, `mapfile`/`readarray` or `declare -n` as making OLDPWD unknown (`previous = undefined`, which refuses a later `~-`/`$OLDPWD`), or refuse it outright; read `env -u OLDPWD`/`env -i` before a shell as an unset OLDPWD inside it; pass the prefix to the command `find -exec` judges.

Also from AR0333's review 4 (F3, F4 of AR0333):
- `cd <main>; cd /tmp; eval 'cd /var' | cat; cd -; rm README.md` passes: an `eval` in a pipeline is not read as a subshell (the folder part is older than AR0333).
- `cd /var; cd <main>; export -n OLDPWD; bash -c 'cd -; rm README.md'` passes: the inner bash has no OLDPWD.

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

- 2026-10-25: Source: F2 of AR0333
