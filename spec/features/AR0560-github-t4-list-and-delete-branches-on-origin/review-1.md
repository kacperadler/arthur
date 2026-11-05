# AR0560 - Review 1

- Job: 2026-11-05-review-ec20ce8c
- Branch: arthur/2026-11-05-worker-47bcd35a
- Commit reviewed: 7a9824b773aa7f17330f2ff7b93063bd440b439c
- Verdict: PASS

## Final message

I found no blocking findings. The branch delivers `arthur github branch list` and `arthur github branch delete <branch> [--unmerged]` as the AR0560 ticket and the AR0556 plan ask. Both use git's own credentials and the same `deleteOnOrigin`, no-prompt env and Git-config check as `push`. `sweep` and the prune now read the same `originBranches` result (`{ tips, head }`).

- **Every refusal the ticket lists has a test**, using real Git and a bare origin in a temporary folder (`packages/github/test/github-branch.test.ts`): the checkout's main, origin's default branch, a job's branch that has not ended, an unmerged tip without `--unmerged`, and a tip moved since the read (the lease answers `[rejected] (stale info)`). It deletes once and refuses a second delete. A planted `core.sshCommand` is refused, and a job's call to `delete` is refused because `delete` is not in `READS`.
- **Bypasses I looked for found none that a plain command gets through:**
  - Full ref names (`refs/heads/main`) don't match the short-name keys, so they are refused as `origin has no such branch`.
  - The exact-name pattern in `ls-remote` does not match a longer branch name.
  - The job check matches only the exact branch name and the terminal `ended` state.
- **Budget and size:** the github budget raise 1076 → 1124 is recorded (AR-D509). `github-branch.ts` is 188 lines, so it stays green.
- **Docs:** the usage line, both command pages, `github.md`, the README, the config example and both diagrams are updated. A search for `ls-remote --heads` and the old usage string in `packages`, `docs`, `README.md`, `spec/roadmap.md` and `arthur.config.example.ts` found nothing.
- **The one survivor is not a finding:** the `npm run mutate` survivor at `packages/github/src/github-git.ts:88` is the comment and type-signature hunk of `originBranches`. Node strips types before running, so reverting it changes nothing at runtime, and `tsc` would catch it. The behavior hunks in that file (the pattern and `--symref`, the `head` parse) were caught.

## Notes
- (risk) packages/github/src/github-git.ts:98: `head` falls back to "" when origin does not report a default branch. The "origin's default branch" refusal then never fires, and only the server's own protection stops that delete. GitHub does report it.
- (minor) packages/github/docs/commands/github-branch.md:9: the page says `list` shows "the newest" job on a branch, but the code takes the first one `host.jobs.list()` returns. Only one job has a given `arthur/<id>` branch, so this matters little.
- (minor) README.md, arthur.mmd, docs/architecture/core-and-plugins.mmd and arthur.config.example.ts are outside the ticket's Scope In. Changing them is required, because the review criteria fail any doc left describing the old commands.

## Checks (on 7a9824b7)
- `npm run check && npm test` (timeout 1800): tsc clean. The first run's filter didn't print the counts, so I ran `npm test` again: 1568 tests, 1504 pass, 0 fail, 64 skipped.
- `npm run mutate` (its own call): 25 mutants, 24 caught, 1 survived (`github-git.ts:88`, the comment and type hunk above); 77 not run (`--max 25`).
- Hand mutations in `packages/github/src/github-branch.ts`, running only `github-branch.test.ts`. Each was restored with `git checkout --` and `git status` came back clean.
  - Removing the `--unmerged` check (`!unmerged &&`): 11 pass, 1 fail.
  - Removing `state !== "ended"` from the job refusal: 11 pass, 1 fail.

PASS