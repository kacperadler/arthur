# AR0399 - Review 1

- Job: 2026-11-05-review-16f02ec7
- Branch: arthur/2026-11-05-worker-c3195e81
- Commit reviewed: e743f40e6ebb9997e14e89193980a2c9b8bcd872
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Before `git lfs push origin <ref>` runs on a `filter=lfs` branch, `push` (`packages/github/src/github-git.ts:79-92`) now runs `git push --porcelain --dry-run` on the same ref, with the same `-c` settings from `originCheck` and the same `quiet()` environment. If the dry run fails, the reply is the reason the push itself would give, and git-lfs never runs. This meets the ticket's Done means:

- **Covered forms:** the new test at `packages/github/test/github.test.ts:686-716` tries origin as a folder whose `pre-receive` hook writes a marker, `file://`, `evil::…`, `evil://…`, `ext::…` and an `evil://` pushurl. For each it checks that `push` refuses with `fatal: transport '<name>' not allowed`, and that no git-lfs, helper, `ext` command or hook ran.
- **Allowed folder:** once the test's own `GIT_CONFIG_GLOBAL` allows `protocol.file`, the upload runs and then the push runs, in that order.
- **Test resources:** the test uses temporary folders only, its own global config and fake binaries on PATH, and no production names.
- **Docs:** `packages/github/docs/github.md:64` and `docs/deploy.md:42` now describe the dry run, matching the code.
- **Worker's claims:** the probe results the worker reported for real git-lfs 3.5.1 match what the test assumes.
- **Scope:** F1 in `findings.md` (a committed `.lfsconfig` that sends the upload to another server) is outside this ticket, as you said.
- **Line budget:** the `github` package stays within its line budget, and no file moved into yellow or red.

## Notes
- (risk) packages/github/src/github-git.ts:84-89: there is a gap between the dry run and the upload. Git checks origin's URL in the dry run, then git-lfs reads the config again. A process that rewrites `remote.origin.url` or `pushurl` in between gets past the check. The gap is short, and the earlier `originCheck` read has the same limit.
- (minor) packages/github/src/github-git.ts:84: an LFS push now contacts origin one extra time for the dry run, which costs a round trip and, over HTTPS, one more credential lookup.

## Checks (on e743f40e)
- `npm run check && npm test` (ran twice; the second run gave the counts): the type check passed, 1556 tests, 1492 pass, 0 fail, 0 cancelled, 64 skipped, exit 0.
- **Mutation by hand:** I changed `if (ran.code !== 0) return failed(...)` to `if (ran.code !== 0 && !lfs) ...` so a failed dry run no longer stops the upload. `node --import @arthur/core/testing --test packages/github/test/github.test.ts` then gave 23 tests, 21 pass, 2 fail, and the new AR0399 test was among the failures. I restored the file with `git checkout -- packages/github/src/github-git.ts`, and `git status --short` was clean.
- `npm run mutate`: I did not run it, because you asked me to keep this review short. The worker reports `--max 4`: 4 caught, 0 survived.

PASS