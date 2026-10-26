# AR0429 - The guard misreads four short forms: $ARTHUR_JOB, env -C and sudo -D, a ~ after =, cd $PWD and cd ~+

```json
{
  "id": "AR0429",
  "title": "The guard misreads four short forms: $ARTHUR_JOB, env -C and sudo -D, a ~ after =, cd $PWD and cd ~+",
  "date": "2026-10-25"
}
```

## Description

Merged by AR-D35 from four tickets the owner dropped into this one: AR0334, AR0415, AR0416, AR0421. Each is a short form an agent may write that the worktree guard reads wrongly, so a write is judged somewhere other than where bash runs it:

1. AR0334: `echo x > $ARTHUR_JOB/result` and `echo x > "$ARTHUR_JOB"/../<other job>/result` pass, while the same paths spelled out are refused: the parser turns the variable into nothing, though the guard knows its value (`worktree-guard.ts`, `worktreeGuard`).
2. AR0415: `env -C <dir>`/`env --chdir=<dir>` and `sudo -D <dir>`/`sudo --chdir=<dir>` before a command change its folder; the guard skips them as option values and judges the command from the job's `cwd` (`commandIndex`, `judge`).
3. AR0416: a `~` after the `=` of an assignment before git is not expanded (`shell-words.ts`), so `GIT_WORK_TREE=~/<main> git checkout -- .` resets main's files; a reviewer proved it with a temporary HOME.
4. AR0421: `$PWD`, `${PWD}` and `~+` expand to nothing or a literal folder `~+`, so `cd $PWD` is read as `cd $HOME` while bash stays where it is.

## Goal

Each of the four forms is read as bash runs it, so the writes after them are judged in the right place; tested.

- Kind: security

## Done means

- Form 1: `shellCommands` knows `HOME` and `ARTHUR_JOB` (a map of known variables in place of `home`). Tests: the two commands above refused naming the place they reach; `echo $ARTHUR_JOB` passes.
- Form 2: the folder of `env -C`/`--chdir` and `sudo -D`/`--chdir` before the command is resolved and the command judged from it. Tests: `env -C <main> git checkout -- .`, `env --chdir=<main> rm README.md` and `sudo -D <main> rm README.md` refused naming the main checkout.
- Form 3: `~` after `=` in an assignment word is expanded. Tests: `GIT_WORK_TREE=~/<main> git checkout -- .`, `GIT_INDEX_FILE=~/<main>/.git/index git add .` and `env GIT_INDEX_FILE=~/<main>/.git/index git add .` refused naming the main checkout.
- Form 4: `$PWD`/`${PWD}` read as `~+`, and `~+` (unquoted, alone or before `/`) is `cwd`. Tests: with the call's `cwd` in the main checkout, `cd $PWD; rm README.md`, `cd "$PWD"; rm README.md` and `cd ~+; rm README.md` refused naming the main checkout.
- Every test row fails on main. No form that main refuses passes after the change.
- `worktree-guard.ts` and `shell-words.ts` stay at 200 lines each; the core's line budget may be raised by the lines needed (AR-D29), named in `test/structure.test.ts` with this ticket.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/worktree-guard.ts`, `packages/core/src/shell-words.ts`, `packages/core/test/worktree-guard.test.ts`, `test/structure.test.ts` (only for a budget raise).

Out:
- Other variables, other wrappers, operands built at run time (AR0336, dropped), the OLDPWD forms of AR0422 (dropped).

## Decisions

- 2026-10-26: Merged from AR0334, AR0415, AR0416 and AR0421 by AR-D35
- 2026-10-27: AR0429: the guard refuses only writes that really land in a guarded place, so the two forms that write elsewhere pass (the coordinator's recommendation, under AR-D98); the owner: "always go with your recommendation" (AR-D113)
- 2026-10-27: AR0429: another round, the worker adds the two missing tests, then review round 3 (the coordinator's recommendation, under AR-D98); the owner: "always go with your recommendation" (AR-D119)
