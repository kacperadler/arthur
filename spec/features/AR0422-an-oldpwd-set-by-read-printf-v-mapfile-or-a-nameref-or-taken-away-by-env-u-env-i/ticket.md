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

The guard follows OLDPWD set or taken away by the forms below, or refuses a later `cd -`, `~-` or `$OLDPWD` as unknown; tested.

- Kind: security

## Done means

- Each form in the Description (`read`, `printf -v`, `mapfile`, a nameref, `declare -n`, `env -u OLDPWD`/`env -i` before a shell, `export -n OLDPWD` before a shell, an `eval` in a pipeline, `pushd -n -`, a quoted `'~-'`) either is followed as bash runs it or makes OLDPWD unknown so a later `cd -` is refused. One row each in `worktree-guard.test.ts`, refused naming the main checkout or OLDPWD unknown, each failing without its fix.
- A prefix before `find -exec`, `xargs` or a script file: judged with the prefix, or listed as a documented limit in the guard's docs if it cannot fit.
- Both source files stay at 200 lines or under; the core's budget is full, so a fix that needs more ends `Blocked: user` asking for a raise.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, `packages/core/src/shell-words.ts`, `packages/core/test/worktree-guard.test.ts`.

Out:
- The forms of AR0420 and AR0421.

## Decisions

- 2026-10-25: Source: F2 of AR0333
- 2026-10-25: AR0422 approved as written; the owner: "AR0421 to AR0426 - all" (AR-D23)
