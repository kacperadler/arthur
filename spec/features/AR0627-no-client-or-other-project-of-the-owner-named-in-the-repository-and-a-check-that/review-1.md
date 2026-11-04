# AR0627 - Review 1

- Job: 2026-11-04-review-416e6684
- Branch: arthur/2026-11-04-worker-331520f3
- Commit reviewed: 79578dad7e11933ba53a06b2674813fb3a7d786e
- Verdict: PASS

## Final message

No finding blocks the merge. The branch does what AR0627 asks, and the sign-off exemption follows AR-D501.

- **Tracked files are clean:** I ran the check itself (`otherProjects` + `namings`) with the two names it reads from the main checkout's `projects/`. Nothing at the tip names another project. The same holds for the message of every commit in `da806fea..79578dad`, and for the commit messages that HEAD brings in the suite's test.
- **Rewording:** each mention uses a made-up name (`landing.example`, `web-shop.example`). The past one-off entry is gone from `spec/schedule.json`. Main had already reworded `spec/decisions.jsonl` and the AR0618 ticket in `93325f2a`.
- **The check (`test/other-projects.ts`):** it reads the names at run time and writes none in code, tests or messages. It looks at tracked paths, index contents and commit messages, in any case or in slug form. It names the file or commit and the project. Its own test checks the `HEAD^1..HEAD` range of a merge, from inside a worktree, a clone with no `projects/`, and the hook.
- **Sign-off exemption (AR-D501):** only the address of a `Signed-off-by:` line is exempt, and only when it is the commit's own author's or committer's address, compared in any case. The rest of that line, and the same address anywhere else, are still refused. The tests cover this for both paths, `npm test` and the hook.
- **Running it on every commit:** the check runs in `npm test` and so in `arthur merge`. `.githooks/commit-msg` covers the other commits once the coordinator sets `core.hooksPath` after the merge, as you said. The `docs/setup.md` line describes the check, the exemption and the hook.
- **Shape:** all new files are green (64, 98 and 3 lines). There is no new dependency and no boundary break.

## Notes
- (risk) `packages/delivery/src/merge-command.ts:89`: the `spec: <id> merged` commit is made with hooks off. Its files are checked only by the next `npm test` on main, after the push. The worker filed this as F1, and the line at `docs/setup.md:121` says "every commit there" without this exception.
- (risk) `test/other-projects.ts:24`: when `projects/` is missing or can't be read (a job on another machine, a sandbox that hides it), the check sees no names and passes without saying so. This is F6; I didn't run that case.
- (minor) `test/other-projects.ts:49`: names are matched only as written or in slug form. The name with the separator dropped or written as `_` gets through, and so does a part of the name such as the domain without its TLD.
- (minor) `test/other-projects.ts:40`: the exemption trusts any commit's own address, not only the owner's. A commit whose author is set to an address naming another project gets its sign-off exempted. The worker says this in its message.

## Checks (on `79578dad`)
- `npm run check && npm test`: tsc passed. In the first run a filter of mine dropped the test summary, so I ran `npm test` again: 1548 tests, 1484 pass, 0 fail, 0 cancelled, 64 skipped, exit 0.
- Running the check against all commit messages in the range: 2 names read, 0 hits.
- I didn't run `npm run mutate`, to save budget; I made two mutations by hand and ran `node --import @arthur/core/testing --test test/other-projects.test.ts` on each:
  - Exemption always on (`message.own.includes(...)` → `true`): 3 pass, 2 fail, so it is caught.
  - Slug form removed: 2 pass, 3 fail, so it is caught.
  - I restored both with `git checkout -- test/other-projects.ts`, and `git status --short` was empty.

PASS