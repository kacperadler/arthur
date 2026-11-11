# AR0672 - Review 1

- Job: 2026-11-10-review-e1a87af7
- Branch: arthur/2026-11-10-worker-7e0d5f03
- Commit reviewed: 40c458f84320b0cf14d526d4b27e249684dc743f
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0672 asks.

- **The fix:** `pluginFiles` (`packages/develop/src/plugin-template.ts:5-6`) now takes a `version` and writes it into the new package.json. `locked` (`packages/develop/src/plugin-new.ts:59-61`) copies `name`, `version` and `license` from that package.json into the lockfile entry. `pluginNew` reads the version from the root it writes into, which is the job's worktree inside a job. The worktree test sets that version to `9.8.7` and checks that both the package.json and the lockfile get it.
- **The test the ticket names:** the "passes as created" test now also runs `packages/core/test/plugin-range.test.ts` on the copy and expects `✔ one release: `. With the base's `src/` files put back it fails. When I also removed the two new exact-match checks (lockfile entry and package.json), it failed at `plugin-new.test.ts:95`, the `tests.status` check on the run that includes plugin-range. So the plugin-range run alone catches the bug too.
- **Docs:** both changed lines of `packages/develop/docs/commands/plugin.md` describe the new version handling. Its line 33 ("passes … `npm test` … with no hand edit") is now true. I found no other stale text in `packages/`, `spec/roadmap.md`, `README.md` or `.agents`.
- **Scope and size:** only the three files the ticket's Scope names, plus the doc, changed. `plugin-new.ts` is 144 lines and `plugin-template.ts` is 58, both green. There is no `findings.md` on the branch.

## Notes
- (minor) packages/develop/src/plugin-new.ts:80: when the root has no `package.json`, the version falls back to `""`. `refusal` does not check for a root `package.json` (it checks `packages/core/package.json`), so a root that passes every other check would get `"version": ""`. A real Arthur checkout always has one, so this case is unlikely.
- (minor) packages/develop/src/plugin-new.ts:80: a hand-broken root `package.json` makes `JSON.parse` throw with a stack trace instead of a `refused:` line. Reading `package-lock.json` already behaves this way.

## Checks (all on 40c458f8)
- `npm run check`: tsc, no errors.
- `npm test`: 1716 tests, 1652 pass, 0 fail, 0 cancelled, 64 skipped. This matches the worker's numbers.
- `npm run mutate`: `mutate: 16 mutants, 16 caught, 0 survived`.
- Base `src/` files with the branch's tests (`node --import @arthur/core/testing --test packages/develop/test/plugin-new.test.ts`): 5 pass, 2 fail ("as created" and "in a job only its own worktree"), so the new tests fail before the fix.
- Base `src/` files with the two new exact-match checks removed, "as created" test only: fails at `plugin-new.test.ts:95`.
- After each run I restored the files with `git checkout 40c458f8 -- packages/develop`, and `git status --short` was empty.

PASS