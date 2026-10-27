# AR0471 - Review 5

- Job: 2026-10-27-review-804fd865
- Branch: arthur/2026-10-27-worker-c28e3457
- Commit reviewed: db7027949729a9d9e49a9eef538bf33f4216b891
- Verdict: PASS

## Final message

This branch can merge. Review 4's finding is fixed: a `~` inside a double-quoted fallback is now read as plain text, as bash reads it. The new refusal of `$'…'` and `$"…"` holds, and every bypass from reviews 1 to 4 that I re-tried is refused. The one variant that still passes, a line continuation between `$` and the quote, comes from an older gap in the parser and passes on the base too.

## Findings
None blocking.

## Notes
- **Line continuation gets past the new refusal (not counted: the base passes it too).** In `rm "${x:-$\<newline>'..'}/../acme/README.md"`, and the same with `".."`, a backslash and a newline sit between `$` and the quote, so the new `$['"]` check in `shell-words.ts:89` never sees `$'`.
  - The guard reads a folder named `$'..'` (tip) or `$..` (base), so the path stays inside the worktree.
  - Real bash 5.2.21 reads `..`, and in a scratch folder it deleted `../acme/README.md` for both forms.
  - With that row added to the guard test for one run, the guard returned `undefined` where `UNKNOWN` was expected. I restored the file afterwards.
  - It is not a regression. The parser never removes a backslash-newline right after `$`, even outside a fallback: `rm $\<newline>'..'/…` reads `$..` and `$\<newline>HOME` reads as plain text `$HOME`.
  - `findings.md` does not record it. It should get its own finding or ticket.
- **An older gap, outside the range:** `closing()` (`shell-words.ts:39`) skips over quotes without honouring `\"` inside them. So `echo "${x:-"\""}"; rm X` hides the `rm X` from the guard, on the base and on the tip, and bash runs it. It needs a finding.
- **F2 names the owner's real user:** it writes an existing user's home. That is not a client or another project, but `~acme` would be safer in a public repository.
- **Line counts:** `shell-words.ts` has 198 lines and `worktree-guard.ts` 200, as the worker said.
- **The worker's claims hold:** the files, rows, refusal text, mutation results and the reasoning about `extquote` all match what I saw.

## Checks
- **`npm run check`:** exit 0.
- **`node --test packages/core/test/worktree-guard.test.ts`:** 11 tests, 11 pass, 0 fail.
- **Full `npm test` (run by the host, not by me):** 1195 tests, 1189 pass, 0 fail, 6 skipped (the expected 6).
- **Parser against real bash 5.2.21:** I compared `shellCommands` with bash's `printf` output for about 60 forms, all unset `x`, `HOME=/h`. They match on:
  - `~`, with `-`, `=` and `:-`;
  - `~+`, `~-` and `~root` (kept as text);
  - nested `"~"`, `'~'`, `\~`, `\"~\"`, `"$HOME"`, `~"$HOME"`, `${y:-~}`, and `"${y:-~}"` nested inside an unquoted fallback;
  - a tab, two spaces, a leading space, `a\ b`, `a\;b` and `'a;b'` inside double quotes;
  - unquoted `${x:-~}`, `${x:-'~'}`, `${x:-~"/a"}` and `${x:-$'..'}`.

  `"${x:-$'a'}"`, `"${x:-$"a"}"`, `"${x:-\\$'a'}"` and `"${x:-${y:-$'..'}}"` are refused. `"${x:-\$'a'}"` passes as text.
  The only differences are `:+` and `:?`, which compute an operator (out of scope), and inputs bash cannot parse.
- **Mutations of `shell-words.ts`:** 15, each confirmed applied, run with `--test-name-pattern="each call that writes"`, then restored. The test failed on every one:
  - the `$quote` refusal turned off; only `$'` refused; only `$"` refused;
  - its backslash check dropped, so an escaped `\$'` is refused too;
  - the fallback not wrapped in double quotes; inner `"` kept; escaped `\"` removed too;
  - the unquoted refusal turned off; `#` dropped from it; `\s` dropped from it; `unsure` ignored;
  - `known` not passed to the fallback;
  - `value(of)` dropped; `of === "PWD"` dropped;
  - the heredoc `\0-` replace removed.
- **The line-continuation bypass above** was tested with real bash deletions in a `mktemp -d` folder (removed) and with one temporary row in the guard test (restored).
- **Cleanup:** the `.probe/` scratch folder is removed and `git status` is clean.

PASS