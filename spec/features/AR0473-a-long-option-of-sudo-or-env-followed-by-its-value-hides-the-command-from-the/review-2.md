# AR0473 - Review 2

- Job: 2026-10-27-review-a830f22d
- Branch: arthur/2026-10-27-worker-67871c96
- Commit reviewed: 3db055998e1d7041d9b0ba7fdbd0f5592acbb9f4
- Verdict: PASS

## Final message

I found no blocking issues. The two env options added this round are correct, and the new rows catch the bugs they are meant to catch.

**Findings**

None.

**Notes (don't block the merge)**
- **Sources match.** I fetched coreutils `src/env.c` (master). Its long options are argv0, env0-from, unset, chdir, quoting-style and split-string with a required value; ignore-environment, null, list-signal-handling and debug with none; and default-, ignore- and block-signal with an optional one. `packages/core/src/worktree-guard.ts:20` lists env the same way: `=` on the value-takers, none on the optional ones, which only take a value written with `=`. env's short options are `+a:C:iS:u:v0`, matching `-a -u -C -S`. I also fetched sudo's `src/parse_args.c` (main): the sudo list matches its short options (`+Aa:BbC:c:D:…`) and all 31 long options.
- **Prefixes resolve as getopt_long does.**
  - `--e` matches only `--env0-from=` and `--q` only `--quoting-style=`.
  - On real env 9.4 here, `--e` and `--q` fail with "unrecognized option" and exit 125, so on an older env these rows refuse a call that would never have run anyway.
  - No full option name is the start of a longer one that takes a value. The line-17 comment says the code relies on this, and it holds for both lists.
- **Still open, not fixed by this branch:** F1 and F2 in `findings.md`. F1: long options of `timeout`, `nice` and the other wrappers still hide the command. F2: the command line given to `env -S` is not read.
- **One full `npm test` run of mine was stopped.** I started it before your interjection, then killed only my own processes (the ones running in my worktree). The other run's processes were left alone. The file-level failures that run printed come from the kill, so they are not a result.

**Checks I ran**
- `npm ci`: 22 packages added.
- `npm run check` (tsc): no errors.
- `node --test packages/core/test/worktree-guard.test.ts`: 11 pass, 0 fail.
- Mutations, each restored with `git checkout --` (`git status` was clean at the end); every one was caught:

| Mutation | Row that failed |
|---|---|
| removed `"--env0-from=", ` | `env --env0-from X rm …` |
| removed `"--quoting-style=", ` | `env --quoting-style X rm …` |
| exact long names only, no prefixes | `env --c=… rm README.md` |
| short prefixes (≤3 chars) other than `--chdir` stop matching | `env --u X rm …` |
| same, with the `--unset`, `--u`, `--argv0`, `--env0-from` and `--quoting-style` rows removed | `env --e X rm …`, so the new prefix row catches it on its own |
| an ambiguous prefix takes the first match (`options.length >= 1`) | `sudo --login rm …` |
| any matched long option takes the next word | `env --ignore-environment rm …` |
| a value written with `=` still skips the next word (dropped `long[2] === ""`) | `env --chdir=… rm README.md` |

- `wc -l packages/core/src/worktree-guard.ts`: 200 lines, at the limit, not over.

PASS