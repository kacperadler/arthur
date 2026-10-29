# AR0493 - Review 2

- Job: 2026-10-28-review-02f78d3b
- Branch: arthur/2026-10-28-worker-86ff30bd
- Commit reviewed: e15e7571e53e12c6e652939eb9fced9adb4f9968
- Verdict: FAIL

## Final message

**Findings**

1. **The guard still lets an `rm` of the main checkout through when a `#` sits inside an unquoted `${…}`** (`packages/core/src/shell-join.ts:53,63`). The ticket requires removing a backslash-newline wherever bash does, so that `$\<newline>HOME` reads as `$HOME`. `joinLines` only tracks `${` inside double quotes (line 50). Outside quotes, the `#` in `${x// #/}` counts as the start of a comment (line 63), so `joinLines` copies the rest of the line unchanged and never joins `$\<newline>HOME`.
   - `rm ${x// #/} $\<newline>HOME/acme/README.md` is allowed by the guard.
   - `${x% #}` and `${x:0: #1}` get through the same way.
   - bash 5.2 (`env -i HOME=… bash`) prints `/h/acme/README.md` and `rm -v` reports `removed '…/acme/README.md'`.
   - The worker's new row covers only the double-quoted `"${x:- #}"`. The unquoted fallback `${x:- #}` happens to be refused through `\0-`, but other operators are not.
   - The base commit lets it through too, so this is an unfixed case of the ticket's own requirement.

2. **A `<<` inside an unquoted `${…}` is read as a heredoc** (`packages/core/src/shell-join.ts:64`). For `echo ${x//<<'E'/}\nrm $\<newline>HOME/acme/README.md`, `joinLines` treats the following lines as the body of a heredoc with a quoted delimiter, so it does not join them.
   - The guard allows the command.
   - The same command without the backslash-newline is refused.
   - bash runs `rm` on `$HOME/acme/README.md` and removed the file.
   - This is the same root cause as finding 1: `${` outside double quotes is not tracked.

3. **Four mutations of key behaviour survive `worktree-guard.test.ts` and `env-guard.test.ts`.** Each one turns a command that the unchanged code refuses into one the guard allows. bash deleted `$HOME/acme/README.md` for every command listed.
   - **M9**, `shell-join.ts:50`: change `(inside === '"' || inside === "}")` to `inside === '"'`, so a nested `${` is no longer tracked. This lets through `rm "${x:-${y}'}" '}" $\<newline>HOME/acme/README.md`.
     - The worker's row `"${x:-${y:-"'"}}"` gives the same result whether nesting is tracked or not, so the nesting claim in the final message has no test behind it.
   - **M25**, `shell-join.ts:56`: change `heredoc.depth <= within.length` to `<`. This lets through `cat <<'EOF' $(echo)\na\\\nEOF\nrm $HOME/acme/README.md`.
   - **M28**, `shell-join.ts:52`: change `[out, at] = [out + char, open]` to `at + 1`, so a backslash-newline between `$` and `(` is not skipped. This lets through `rm "$\<newline>(echo "'")" $\<newline>HOME/acme/README.md "'"`.
   - **M30**, `shell-join.ts:17`: drop the `double!.replace(...)` that unescapes a double-quoted heredoc delimiter. This lets through `cat <<"E\$F"\na\\\nE$F\nrm $\<newline>HOME/acme/README.md`.

**Notes (not blocking)**
- **M29 also survives:** pushing `${` outside quotes too (`shell-join.ts:50`). No bypass was found for it; it may only refuse too much. Tracking unquoted `${…}` is likely also the fix for findings 1 and 2.
- **`case … )` inside a `$(…)` in double quotes:** `shellCommands` and `joinLines` both close the substitution at the `)` of a case pattern. `rm "$(case a in a) echo "'" ;; esac)" $HOME/x` is misread even without a backslash-newline. This already exists on base and is outside this range.
- **Line budget:** raised to 6490 in `test/structure.test.ts`; the ticket's decision AR-D63 allows it.
- **Final message:** its other claims match the diff: the new `shell-join.ts`, `shellCommands` calling `joinLines` first, the test rows, and findings.md F1.

**Checks run**
- `npm ci`: added 22 packages.
- `npm run check` plus `npm test` in the foreground with a 1800 s timeout: the harness moved it to the background, and it finished with tsc clean, tests 1229, pass 1168, fail 0, skipped 61. A second run written to a file in the worktree gave the same result with `EXIT 0`; the file is deleted.
- **Mutation sweep:** 30 mutations of `shell-join.ts`, run in a copy of the tree under `/tmp` against `worktree-guard.test.ts` and `env-guard.test.ts`. 25 were caught; M9, M25, M28, M29 and M30 survived.
- **Probe scripts:** they ran `worktreeRefusal` against the unchanged branch, each mutant, and base `48b4051d`, with commands checked in bash 5.2 using `env -i HOME=… bash` and `rm -v`. That produced the results above.
- **Clean-up:** all throwaway files are removed and the worktree is clean.

FAIL