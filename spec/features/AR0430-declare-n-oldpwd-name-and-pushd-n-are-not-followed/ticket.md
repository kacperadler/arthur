# AR0430 - `declare -n OLDPWD=name` and `pushd -n -` are not followed

```json
{
  "id": "AR0430",
  "title": "`declare -n OLDPWD=name` and `pushd -n -` are not followed",
  "date": "2026-10-25"
}
```

## Description

F2 of AR0420 (spec/features/AR0420-forms-of-oldpwd-and-pushd-the-guard-still-misreads-oldpwd-operators-readonly/findings.md).

- Kind: security
- Found by: 2026-10-25-worker-3e326757 (worker), 2026-10-25
- Where: `packages/core/src/worktree-guard.ts:101`, `:111`
- What: with real bash, `cd /tmp; cd /var; declare -n OLDPWD=HOME; cd -` goes to `$HOME`; the guard reads it as `OLDPWD=HOME`, a relative path. `pushd -n -` puts the literal `-` on the stack, and a later `popd` goes to OLDPWD as it is then; the guard puts `<cwd>/-` there. Both were seen with `env -u OLDPWD bash -c …`.
- Suggestion: refuse `declare`/`typeset -n` naming OLDPWD as unknown, and keep `-` on the guard's stack as `-`, resolved at the `popd`.


Also F3, F4 of AR0420: `function f { local OLDPWD=…; }; f` and `{ local OLDPWD=…; }` at top level are not seen; `declare`/`typeset` inside a function act as `local` in bash but are followed as assignments.

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

- 2026-10-25: Source: F2 of AR0420
