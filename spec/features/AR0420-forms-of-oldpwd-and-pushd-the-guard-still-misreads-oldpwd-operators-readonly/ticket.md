# AR0420 - Forms of OLDPWD and pushd the guard still misreads: ${OLDPWD...} operators, readonly, local outside a function, pushd -n, OLDPWD+= before eval

```json
{
  "id": "AR0420",
  "title": "Forms of OLDPWD and pushd the guard still misreads: ${OLDPWD...} operators, readonly, local outside a function, pushd -n, OLDPWD+= before eval",
  "date": "2026-10-25"
}
```

## Description

Split from AR0333 by AR-D17: review 3 of AR0333's branch (spec/features/AR0333-cd-pushd-with-no-operand-and-oldpwd-are-read-as-cd-home/review-3.md) found five forms that still take a job back into the main checkout. Each passes the worktree guard while real bash (`env -u OLDPWD bash -c …`) deletes the main checkout's `README.md`; each passed before AR0333 too.

1. `packages/core/src/shell-words.ts:93-94`: `${OLDPWD…}` with an operator. `:-`, `-`, `=` take the default text even when OLDPWD is set; `%`, `#`, `/` expand to nothing, read as `cd $HOME`. E.g. `cd <main>; cd <other>; cd ${OLDPWD:-/tmp} && rm README.md`.
2. `packages/core/src/worktree-guard.ts:99`: `readonly OLDPWD[=x]` and `declare -r OLDPWD` are followed as a plain assignment, but afterwards bash's `cd` no longer changes OLDPWD while the guard still moves `previous` (`:111`). E.g. `readonly OLDPWD=<main>; cd <other>; cd -; rm README.md`.
3. `worktree-guard.ts:99`: `local OLDPWD=x` outside a function is taken as an assignment; bash refuses it there and keeps OLDPWD. E.g. `cd <main>; cd <other>; local OLDPWD=/tmp; cd -; rm README.md`. Removing `"local"` from the list fails no test.
4. `worktree-guard.ts:107-108`: a bare `pushd -n` is read as a swap; bash does not change folder. E.g. `pushd <main>; pushd -n; rm README.md`.
5. `worktree-guard.ts:119`: the `eval` restore checks `/^OLDPWD\+?=/`; changing it to `/^OLDPWD=/` fails no test and lets `cd <main>; cd <other>; OLDPWD+=/ eval 'cd /var'; cd -; rm README.md` through.
6. `worktree-guard.ts:99` (review 4 of AR0333, added by AR-D19): OLDPWD array assignments are not followed; in bash `OLDPWD[0]` is `$OLDPWD`. `cd /tmp; cd /var; OLDPWD[0]=<main>; cd -; rm README.md`, `cd /tmp; OLDPWD=(<main>); cd -; rm README.md` (the `(` is read as a subshell), `cd /tmp; declare OLDPWD[0]=<main>; cd -; rm README.md`.

Also seen, not added by AR0333: `f() { cd -; rm README.md; }; OLDPWD=<main> f`, `OLDPWD=<main> source /dev/stdin <<< 'cd -; rm README.md'`, `cd <main>; pushd -n <other>; rm README.md`.

## Goal

Each of the six forms is read as bash runs it, or refused as unknown; tested.

- Kind: security

## Done means

- One test row per form above (each command of 6) (the example commands), each refused naming the main checkout, each failing without its fix; a row pins `local` and the `+=` of the `eval` restore.
- `worktree-guard.ts` and `shell-words.ts` stay at 200 lines or under; the core's line budget is full, so a fix that needs more lines ends `Blocked: user` asking for a raise.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, `packages/core/src/shell-words.ts`: the five forms.
- `packages/core/test/worktree-guard.test.ts`: the rows.

Out:
- A function, `source` and script files run with a prefix (listed above): a later ticket if wanted.

## Decisions

- 2026-10-25: Source: review 3 of AR0333, split by AR-D17
- 2026-10-25: AR0420 approved, with the OLDPWD array forms of AR-D19 added; the owner: "AR0420 approved" (AR-D20)
- 2026-10-25: AR0420 gets a third round with a simpler rule: any local OLDPWD makes OLDPWD unknown, the brace counting goes; the owner: "AR-D21 1" (AR-D21)
- 2026-10-25: AR0420 another round: the worker adds the two test rows only, then review round 4; until the work is done the coordinator takes its own recommendation without asking; the owner: "AR-D28 complete with your recommendations, and use them till the task is completed, so next time do not ask me, just do it by yourself" (AR-D28)
